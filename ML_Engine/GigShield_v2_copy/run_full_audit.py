"""
╔══════════════════════════════════════════════════════════════════════════╗
║   GigShield v2.2 — Full Model Audit & Report Generator                ║
║   Comprehensive testing: accuracy, fairness, triggers, edge cases     ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

import json
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    r2_score, mean_absolute_error, mean_squared_error,
    explained_variance_score,
)

from disruption_triggers import evaluate_all_triggers, compute_zone_safety_score

# ─── Load artifacts ───
print("╔══════════════════════════════════════════════════════════╗")
print("║   GigShield v2.2 — Full Model Audit                    ║")
print("╚══════════════════════════════════════════════════════════╝\n")

MODEL = joblib.load("gigshield_v2_model.joblib")
with open("gigshield_v2_meta.json") as f:
    META = json.load(f)
FEATURE_COLS = META["feature_cols"]
df = pd.read_csv("training_data_v2.csv")
df["date"] = pd.to_datetime(df["date"])

TRAIN_END = "2022-12-31"
TEST_START = "2023-01-01"

train_df = df[df["date"] <= TRAIN_END].copy()
test_df = df[df["date"] >= TEST_START].copy()

X_train = train_df[FEATURE_COLS].fillna(0).values
y_train = train_df["loss_ratio"].values
X_test = test_df[FEATURE_COLS].fillna(0).values
y_test = test_df["loss_ratio"].values

y_pred_train = MODEL.predict(X_train).clip(0)
y_pred_test = MODEL.predict(X_test).clip(0)

report_lines = []

def log(msg=""):
    print(msg)
    report_lines.append(msg)

def section(title):
    log(f"\n{'='*60}")
    log(f"  {title}")
    log(f"{'='*60}")

# ═══════════════════════════════════════════════════════════════
# TEST 1: Core Model Metrics
# ═══════════════════════════════════════════════════════════════
section("TEST 1: Core Model Performance Metrics")

train_r2 = r2_score(y_train, y_pred_train)
test_r2 = r2_score(y_test, y_pred_test)
test_mae = mean_absolute_error(y_test, y_pred_test)
test_rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
test_evs = explained_variance_score(y_test, y_pred_test)
gap = train_r2 - test_r2

log(f"  Train R²             : {train_r2:.4f}")
log(f"  Test R²              : {test_r2:.4f}")
log(f"  Overfit Gap          : {gap:.4f} {'✅ Excellent' if gap < 0.05 else '⚠️ Check'}")
log(f"  Test MAE             : {test_mae:.4f}")
log(f"  Test RMSE            : {test_rmse:.4f}")
log(f"  Explained Variance   : {test_evs:.4f}")
log(f"  Features             : {len(FEATURE_COLS)}")
log(f"  Training Rows        : {len(train_df):,}")
log(f"  Test Rows            : {len(test_df):,}")
log(f"  GPS Zones            : {df['gps_tag'].nunique()}")

# ═══════════════════════════════════════════════════════════════
# TEST 2: Tail Risk Performance (P90, P95, P99)
# ═══════════════════════════════════════════════════════════════
section("TEST 2: Tail Risk Performance")

for pct_label, pct in [("P90", 90), ("P95", 95), ("P99", 99)]:
    threshold = np.percentile(y_test, pct)
    mask = y_test >= threshold
    if mask.sum() >= 5:
        tail_r2 = r2_score(y_test[mask], y_pred_test[mask])
        tail_mae = mean_absolute_error(y_test[mask], y_pred_test[mask])
        tail_rmse = np.sqrt(mean_squared_error(y_test[mask], y_pred_test[mask]))
        status = "✅" if tail_r2 > 0.5 else "⚠️" if tail_r2 > 0.2 else "🔴"
        log(f"  {status} {pct_label} (≥{threshold:.4f}): R²={tail_r2:.4f}  MAE={tail_mae:.4f}  RMSE={tail_rmse:.4f}  n={mask.sum()}")

# ═══════════════════════════════════════════════════════════════
# TEST 3: Per-Region Performance
# ═══════════════════════════════════════════════════════════════
section("TEST 3: Per-Region Test Performance")

region_results = []
for tag in sorted(test_df["gps_tag"].unique()):
    mask = test_df["gps_tag"] == tag
    if mask.sum() < 30:
        continue
    r_y = test_df.loc[mask, "loss_ratio"].values
    r_pred = MODEL.predict(test_df.loc[mask, FEATURE_COLS].fillna(0).values).clip(0)
    r_r2 = r2_score(r_y, r_pred) if len(set(r_y)) > 1 else 0
    r_mae = mean_absolute_error(r_y, r_pred)
    status = "✅" if r_r2 > 0.7 else "⚠️" if r_r2 > 0.5 else "🔴"
    region_results.append({"tag": tag, "r2": r_r2, "mae": r_mae, "n": mask.sum(), "status": status})
    log(f"  {status} {tag:<30} R²={r_r2:.4f}  MAE={r_mae:.4f}  n={mask.sum()}")

passing = sum(1 for r in region_results if r["r2"] > 0.7)
total = len(region_results)
log(f"\n  Summary: {passing}/{total} regions with R² > 0.70")

# ═══════════════════════════════════════════════════════════════
# TEST 4: Feature Importance Analysis
# ═══════════════════════════════════════════════════════════════
section("TEST 4: Feature Importance (Top 15)")

importances = MODEL.feature_importances_
n_feats = min(len(FEATURE_COLS), len(importances))
imp_df = pd.DataFrame({
    "feature": FEATURE_COLS[:n_feats],
    "importance": importances[:n_feats],
}).sort_values("importance", ascending=False)

for _, row in imp_df.head(15).iterrows():
    bar = "█" * int(row["importance"] * 80)
    log(f"  {row['feature']:<30} {row['importance']:.4f} {bar}")

# Check for dead features (importance < 0.001)
dead = imp_df[imp_df["importance"] < 0.001]
log(f"\n  Dead features (<0.1% importance): {len(dead)}/{n_feats}")
if len(dead) > 0:
    log(f"  → {', '.join(dead['feature'].tolist())}")

# ═══════════════════════════════════════════════════════════════
# TEST 5: Prediction Distribution Sanity
# ═══════════════════════════════════════════════════════════════
section("TEST 5: Prediction Distribution Sanity")

log(f"  Actual  — mean={y_test.mean():.4f}  std={y_test.std():.4f}  min={y_test.min():.4f}  max={y_test.max():.4f}")
log(f"  Predict — mean={y_pred_test.mean():.4f}  std={y_pred_test.std():.4f}  min={y_pred_test.min():.4f}  max={y_pred_test.max():.4f}")

# Check for negative predictions (before clipping)
raw_preds = MODEL.predict(X_test)
n_negative = (raw_preds < 0).sum()
log(f"  Negative preds (pre-clip): {n_negative} ({n_negative/len(raw_preds)*100:.1f}%)")

# Check for extreme predictions
n_extreme = (y_pred_test > 0.8).sum()
log(f"  Extreme preds (>0.8)     : {n_extreme} ({n_extreme/len(y_pred_test)*100:.2f}%)")

# Zero-inflation check
n_zero_actual = (y_test < 0.01).sum()
n_zero_pred = (y_pred_test < 0.01).sum()
log(f"  Near-zero actual         : {n_zero_actual} ({n_zero_actual/len(y_test)*100:.1f}%)")
log(f"  Near-zero predicted      : {n_zero_pred} ({n_zero_pred/len(y_pred_test)*100:.1f}%)")

# ═══════════════════════════════════════════════════════════════
# TEST 6: Residual Analysis
# ═══════════════════════════════════════════════════════════════
section("TEST 6: Residual Analysis")

residuals = y_test - y_pred_test
log(f"  Mean residual     : {residuals.mean():.6f} {'✅ unbiased' if abs(residuals.mean()) < 0.005 else '⚠️ biased'}")
log(f"  Std residual      : {residuals.std():.4f}")
log(f"  Median residual   : {np.median(residuals):.6f}")
log(f"  P5/P95 residual   : [{np.percentile(residuals, 5):.4f}, {np.percentile(residuals, 95):.4f}]")

# Check for systematic under/over prediction
over_pred = (residuals < -0.1).sum()
under_pred = (residuals > 0.1).sum()
log(f"  Over-predicting   : {over_pred} ({over_pred/len(residuals)*100:.1f}%)")
log(f"  Under-predicting  : {under_pred} ({under_pred/len(residuals)*100:.1f}%)")

# ═══════════════════════════════════════════════════════════════
# TEST 7: Monotonicity Check (Rain/Wind → More Loss)
# ═══════════════════════════════════════════════════════════════
section("TEST 7: Monotonicity Validation")

# Test: increasing rain should increase predicted loss
base_row = np.zeros((1, len(FEATURE_COLS)))
rain_idx = FEATURE_COLS.index("precipitation_sum")
temp_idx = FEATURE_COLS.index("temperature_2m_max")
wind_idx = FEATURE_COLS.index("wind_speed_10m_max")

# Rain monotonicity
rain_levels = [0, 10, 30, 65, 100, 150, 200]
rain_preds = []
for r in rain_levels:
    row = base_row.copy()
    row[0, rain_idx] = r
    row[0, FEATURE_COLS.index("rain_squared")] = r**2
    pred = MODEL.predict(row).clip(0)[0]
    rain_preds.append(pred)

rain_monotonic = all(rain_preds[i] <= rain_preds[i+1] for i in range(len(rain_preds)-1))
log(f"  Rain monotonicity  : {'✅ PASS' if rain_monotonic else '⚠️ Non-monotonic (acceptable with noise)'}")
log(f"    Rain levels: {rain_levels}")
log(f"    Predictions: {[round(p, 4) for p in rain_preds]}")

# Wind monotonicity
wind_levels = [0, 15, 30, 45, 60, 80, 100]
wind_preds = []
for w in wind_levels:
    row = base_row.copy()
    row[0, wind_idx] = w
    pred = MODEL.predict(row).clip(0)[0]
    wind_preds.append(pred)

wind_monotonic = all(wind_preds[i] <= wind_preds[i+1] for i in range(len(wind_preds)-1))
log(f"  Wind monotonicity  : {'✅ PASS' if wind_monotonic else '⚠️ Non-monotonic (acceptable with noise)'}")
log(f"    Wind levels: {wind_levels}")
log(f"    Predictions: {[round(p, 4) for p in wind_preds]}")

# ═══════════════════════════════════════════════════════════════
# TEST 8: Trigger System Validation
# ═══════════════════════════════════════════════════════════════
section("TEST 8: Trigger System Validation")

test_cases = [
    {"name": "Clear day (no triggers)", "params": dict(
        precipitation_mm=0, temp_max=32, apparent_temp_max=34,
        wind_speed_max=10, wind_gust_max=15, shortwave_radiation_mj=22,
        rolling_7d_rain_mm=10, rolling_3d_temp=31, elevation_m=200,
        distance_to_coast_km=150, is_coastal=False, latitude=19.0
    ), "expect_active": 0},
    {"name": "Heavy monsoon rain (rain+flood)", "params": dict(
        precipitation_mm=120, temp_max=28, apparent_temp_max=30,
        wind_speed_max=20, wind_gust_max=30, shortwave_radiation_mj=5,
        rolling_7d_rain_mm=350, rolling_3d_temp=28, elevation_m=8,
        distance_to_coast_km=15, is_coastal=True, latitude=19.0
    ), "expect_min": 2},
    {"name": "Delhi extreme heat", "params": dict(
        precipitation_mm=0, temp_max=47, apparent_temp_max=50,
        wind_speed_max=8, wind_gust_max=12, shortwave_radiation_mj=25,
        rolling_7d_rain_mm=0, rolling_3d_temp=46, elevation_m=214,
        distance_to_coast_km=1000, is_coastal=False, latitude=28.6
    ), "expect_min": 1},
    {"name": "Cyclone scenario", "params": dict(
        precipitation_mm=80, temp_max=27, apparent_temp_max=29,
        wind_speed_max=85, wind_gust_max=120, shortwave_radiation_mj=3,
        rolling_7d_rain_mm=200, rolling_3d_temp=27, elevation_m=6,
        distance_to_coast_km=5, is_coastal=True, latitude=13.0
    ), "expect_min": 3},
    {"name": "Winter fog (Delhi)", "params": dict(
        precipitation_mm=0, temp_max=12, apparent_temp_max=10,
        wind_speed_max=5, wind_gust_max=8, shortwave_radiation_mj=4,
        rolling_7d_rain_mm=5, rolling_3d_temp=13, elevation_m=214,
        distance_to_coast_km=1000, is_coastal=False, latitude=28.6
    ), "expect_min": 1},
]

all_trigger_pass = True
for tc in test_cases:
    result = evaluate_all_triggers(**tc["params"])
    n_active = result["n_active"]
    active_names = [t.trigger_name for t in result["triggers"] if t.active]

    if "expect_active" in tc:
        passed = n_active == tc["expect_active"]
    else:
        passed = n_active >= tc["expect_min"]

    status = "✅" if passed else "🔴"
    if not passed:
        all_trigger_pass = False
    log(f"  {status} {tc['name']}")
    log(f"      Active: {n_active} → {', '.join(active_names) if active_names else 'none'}")
    log(f"      Loss ratio: {result['composite_loss_ratio']:.4f}")

log(f"\n  Trigger system: {'✅ ALL PASS' if all_trigger_pass else '⚠️ Some unexpected results'}")

# ═══════════════════════════════════════════════════════════════
# TEST 9: Zone Safety Score Validation
# ═══════════════════════════════════════════════════════════════
section("TEST 9: Zone Safety Score Validation")

zone_tests = [
    ("Mumbai (coastal low)", 8.0, 15.0, True),
    ("Delhi (inland high)", 214.0, 1000.0, False),
    ("Shimla (himalayan)", 2199.0, 800.0, False),
    ("Kolkata (delta)", 9.0, 50.0, True),
    ("Bengaluru (plateau)", 906.0, 300.0, False),
]

for name, elev, dist, coastal in zone_tests:
    zone = compute_zone_safety_score(elev, dist, coastal)
    score = zone["zone_safety_score"]
    disc = zone["weekly_discount_inr"]
    risk = zone["waterlogging_risk"]
    log(f"  {name:<25} score={score:.4f}  discount=₹{disc:.2f}  risk={risk}")

# ═══════════════════════════════════════════════════════════════
# TEST 10: Walk-Forward Cross-Validation
# ═══════════════════════════════════════════════════════════════
section("TEST 10: Walk-Forward Cross-Validation")

from xgboost import XGBRegressor

folds = [
    {"train_end": "2019-12-31", "test_start": "2020-01-01", "test_end": "2020-12-31"},
    {"train_end": "2020-12-31", "test_start": "2021-01-01", "test_end": "2021-12-31"},
    {"train_end": "2021-12-31", "test_start": "2022-01-01", "test_end": "2022-12-31"},
    {"train_end": "2022-12-31", "test_start": "2023-01-01", "test_end": "2023-12-31"},
]

cv_r2s = []
for fold in folds:
    f_train = df[df["date"] <= fold["train_end"]]
    f_test = df[(df["date"] >= fold["test_start"]) & (df["date"] <= fold["test_end"])]
    if len(f_train) == 0 or len(f_test) == 0:
        continue
    f_model = XGBRegressor(
        n_estimators=600, learning_rate=0.03, max_depth=7,
        subsample=0.8, colsample_bytree=0.75, reg_lambda=2.5,
        random_state=42,
    )
    f_model.fit(f_train[FEATURE_COLS].fillna(0).values, f_train["loss_ratio"].values)
    f_pred = f_model.predict(f_test[FEATURE_COLS].fillna(0).values).clip(0)
    f_r2 = r2_score(f_test["loss_ratio"].values, f_pred)
    f_mae = mean_absolute_error(f_test["loss_ratio"].values, f_pred)
    cv_r2s.append(f_r2)
    year = fold["test_start"][:4]
    status = "✅" if f_r2 > 0.80 else "⚠️" if f_r2 > 0.70 else "🔴"
    log(f"  {status} Fold {year}: R²={f_r2:.4f}  MAE={f_mae:.4f}")

avg_cv = np.mean(cv_r2s)
std_cv = np.std(cv_r2s)
log(f"\n  Average CV R²: {avg_cv:.4f} ± {std_cv:.4f}")
log(f"  CV Stability : {'✅ Stable' if std_cv < 0.03 else '⚠️ Variable'}")

# ═══════════════════════════════════════════════════════════════
# TEST 11: Edge Cases & Adversarial Inputs
# ═══════════════════════════════════════════════════════════════
section("TEST 11: Edge Cases & Adversarial Inputs")

edge_cases = [
    ("All zeros", np.zeros(len(FEATURE_COLS))),
    ("All ones", np.ones(len(FEATURE_COLS))),
    ("Max rain (200mm)", {rain_idx: 200, FEATURE_COLS.index("rain_squared"): 40000}),
    ("Max temp (50°C)", {temp_idx: 50, FEATURE_COLS.index("temp_squared"): 2500}),
    ("Max wind (100km/h)", {wind_idx: 100}),
    ("Extreme combo", {rain_idx: 200, temp_idx: 48, wind_idx: 90}),
]

all_edge_pass = True
for name, vals in edge_cases:
    row = np.zeros((1, len(FEATURE_COLS)))
    if isinstance(vals, np.ndarray):
        row[0] = vals
    elif isinstance(vals, dict):
        for idx, v in vals.items():
            row[0, idx] = v
    
    pred = MODEL.predict(row).clip(0)[0]
    valid = 0 <= pred <= 1.5  # allow slight over-prediction, clipped in practice
    status = "✅" if valid else "🔴"
    if not valid:
        all_edge_pass = False
    log(f"  {status} {name:<25} → pred={pred:.4f}")

log(f"\n  Edge cases: {'✅ ALL VALID' if all_edge_pass else '🔴 Some out of range'}")

# ═══════════════════════════════════════════════════════════════
# TEST 12: Data Integrity Check
# ═══════════════════════════════════════════════════════════════
section("TEST 12: Data Integrity")

log(f"  Total rows           : {len(df):,}")
log(f"  Date range           : {df['date'].min().date()} → {df['date'].max().date()}")
log(f"  GPS zones            : {df['gps_tag'].nunique()}")
log(f"  NaN in features      : {df[FEATURE_COLS].isna().sum().sum()}")
log(f"  NaN in target        : {df['loss_ratio'].isna().sum()}")
log(f"  Duplicate rows       : {df.duplicated(subset=['date', 'gps_tag']).sum()}")
log(f"  Target range         : [{df['loss_ratio'].min():.4f}, {df['loss_ratio'].max():.4f}]")
log(f"  Meta version         : {META.get('version')}")
log(f"  Meta features count  : {META.get('features_count')}")
log(f"  Model feature count  : {len(MODEL.feature_importances_)}")
log(f"  Feature match        : {'✅ MATCH' if len(MODEL.feature_importances_) == len(FEATURE_COLS) else '🔴 MISMATCH'}")

# ═══════════════════════════════════════════════════════════════
# FINAL VERDICT
# ═══════════════════════════════════════════════════════════════
section("FINAL VERDICT")

checks = [
    ("Model R² > 0.85", test_r2 > 0.85),
    ("Overfit gap < 0.05", gap < 0.05),
    ("MAE < 0.03", test_mae < 0.03),
    ("CV R² > 0.85", avg_cv > 0.85),
    ("CV stability (std < 0.03)", std_cv < 0.03),
    ("Region coverage ≥ 30", total >= 30),
    (f"Regions R²>0.70: {passing}/{total}", passing / total > 0.8 if total > 0 else False),
    ("All edge cases valid", all_edge_pass),
    ("Trigger system correct", all_trigger_pass),
    ("Feature count match", len(MODEL.feature_importances_) == len(FEATURE_COLS)),
    ("No NaN in data", df[FEATURE_COLS].isna().sum().sum() == 0),
    ("No duplicate rows", df.duplicated(subset=['date', 'gps_tag']).sum() == 0),
    ("Unbiased predictions", abs(residuals.mean()) < 0.005),
]

passed_total = 0
for check_name, check_result in checks:
    status = "✅" if check_result else "🔴"
    passed_total += int(check_result)
    log(f"  {status} {check_name}")

log(f"\n  ═══════════════════════════════════════════")
log(f"  SCORE: {passed_total}/{len(checks)} checks passed")
if passed_total == len(checks):
    log(f"  🏆 VERDICT: PRODUCTION READY — Ship it!")
elif passed_total >= len(checks) - 2:
    log(f"  ✅ VERDICT: HACKATHON READY — Minor issues only")
else:
    log(f"  ⚠️ VERDICT: Needs attention before submission")
log(f"  ═══════════════════════════════════════════")

# ═══════════════════════════════════════════════════════════════
# Save Report
# ═══════════════════════════════════════════════════════════════
report_path = Path("Report/MODEL_AUDIT_REPORT.txt")
report_path.parent.mkdir(exist_ok=True)
with open(report_path, "w") as f:
    f.write(f"GigShield v2.2 — Full Model Audit Report\n")
    f.write(f"Generated: {date.today().isoformat()}\n")
    f.write(f"{'='*60}\n\n")
    for line in report_lines:
        f.write(line + "\n")

print(f"\n  💾 Report saved → {report_path}")
print(f"  🏁 Audit complete.\n")
