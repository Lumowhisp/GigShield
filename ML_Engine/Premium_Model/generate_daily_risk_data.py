"""
╔══════════════════════════════════════════════════════════════════════════════╗
║         DISRUPTION RISK PIPELINE — v3 (Final, Production-Grade)             ║
║          | Parametric Insurance for Gig Workers                   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Architecture:                                                               ║
║    Layer 1 — Economic Simulation    (business logic + explainability)        ║
║    Layer 2A — Pure ML Matrix        (raw + duration + time + interactions)   ║
║    Layer 2B — Hybrid ML Matrix      (2A + risk_score)                        ║
║                                                                              ║
║  Key design decisions:                                                       ║
║    - Time-based split PER CITY (2015–2022 train / 2023–2025 test)           ║
║    - No StandardScaler (tree model, eliminates accidental fit leakage)       ║
║    - Walk-forward cross-validation (5 folds, expanding window)               ║
║    - Overfitting check (train R² vs test R², gap threshold)                  ║
║    - Predict daily → aggregate weekly (correct pipeline consistency)         ║
║    - Feature importance export + validation loop                             ║
║                                                                              ║
║  Outputs:                                                                    ║
║    historical_daily_risk_pipeline.csv      full daily dataset                ║
║    historical_weekly_business_logic.csv    weekly actuarial dataset          ║
║    ml_features_pure.csv                    Version A: zero leakage           ║
║    ml_features_hybrid.csv                  Version B: + risk_score           ║
║    evaluation_report.txt                   R², MAE, overfit check, winner    ║
║    feature_importance_pure.csv             importance per feature (pure)     ║
║    feature_importance_hybrid.csv           importance per feature (hybrid)   ║
║    weekly_with_predictions.csv             weekly loss predictions           ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import openmeteo_requests
import requests_cache
import pandas as pd
from retry_requests import retry
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import r2_score, mean_absolute_error
import warnings
warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# ⚙️  SETUP
# ─────────────────────────────────────────────────────────────────────────────

cache_session = requests_cache.CachedSession('.cache', expire_after=-1)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo     = openmeteo_requests.Client(session=retry_session)

# ─────────────────────────────────────────────────────────────────────────────
# 🌆  CITY CONFIG
# ─────────────────────────────────────────────────────────────────────────────

CITIES = {
    "Mumbai":    {"lat": 19.0760, "lon": 72.8777},
    "Delhi":     {"lat": 28.6139, "lon": 77.2090},
    "Bengaluru": {"lat": 12.9716, "lon": 77.5946},
    "Hyderabad": {"lat": 17.3850, "lon": 78.4867},
    "Ahmedabad": {"lat": 23.0225, "lon": 72.5714},
    "Chennai":   {"lat": 13.0827, "lon": 80.2707},
    "Kolkata":   {"lat": 22.5726, "lon": 88.3639},
    "Surat":     {"lat": 21.1702, "lon": 72.8311},
    "Pune":      {"lat": 18.5204, "lon": 73.8567},
    "Jaipur":    {"lat": 26.9124, "lon": 75.7873},
}

# Per-city radiation baseline (MJ/m²)
# Jaipur/Delhi get significantly more sun than Mumbai/Kolkata.
# Flat global max would distort the humidity_proxy for coastal cities.
CITY_MAX_RADIATION = {
    "Mumbai": 22, "Delhi": 25, "Bengaluru": 21, "Hyderabad": 23,
    "Ahmedabad": 26, "Chennai": 22, "Kolkata": 22,
    "Surat": 23, "Pune": 22, "Jaipur": 26,
}

# Per-city base daily income (INR) — informal/gig worker estimate
CITY_INCOME_MAP = {
    "Mumbai": 950, "Delhi": 900, "Bengaluru": 880, "Hyderabad": 820,
    "Ahmedabad": 780, "Chennai": 800, "Kolkata": 750,
    "Surat": 760, "Pune": 830, "Jaipur": 720,
}

TRIGGER_THRESHOLD = 0.6

# Fixed temporal split — more realistic than 80/20 random
# Train on known past, test on truly unseen future
TRAIN_END_DATE = "2022-12-31"
TEST_START_DATE = "2023-01-01"

# Walk-forward CV folds: each fold expands training window by 1 year
# Train: 2015→year | Test: year+1
# Gives stable R² estimate and shows if model improves with more data
WALKFORWARD_FOLDS = [
    {"train_end": "2018-12-31", "test_start": "2019-01-01", "test_end": "2019-12-31"},
    {"train_end": "2019-12-31", "test_start": "2020-01-01", "test_end": "2020-12-31"},
    {"train_end": "2020-12-31", "test_start": "2021-01-01", "test_end": "2021-12-31"},
    {"train_end": "2021-12-31", "test_start": "2022-01-01", "test_end": "2022-12-31"},
    {"train_end": "2022-12-31", "test_start": "2023-01-01", "test_end": "2023-12-31"},
]

# ─────────────────────────────────────────────────────────────────────────────
# ══ LAYER 1 — ECONOMIC SIMULATION ════════════════════════════════════════════
# Purpose  : Business logic, explainability, actuarial reporting
# Rule     : These columns NEVER enter the ML feature matrix
# ─────────────────────────────────────────────────────────────────────────────

def compute_disruption_features(df: pd.DataFrame, city: str) -> pd.DataFrame:
    """
    Multi-factor, duration-aware, non-linear disruption scoring.

    Step 1 — Normalize raw features        (mm, °C, km/h → comparable scale)
    Step 2 — Duration scores               (rolling windows, compounding risk)
    Step 3 — Environmental stress proxy    (radiation inversion → overcast signal)
    Step 4 — Weighted composite score      (parametric insurance weights)
    Step 5 — Non-linear amplification      (extremes grow disproportionately)
    Step 6 — Disruption probability        (continuous [0,1] output)
    Step 7 — Binary payout trigger         (threshold-based label)
    """
    max_rad = CITY_MAX_RADIATION.get(city, 24)

    # Step 1 — Normalize
    df["rain_score"] = df["precipitation_sum"]  / 50.0
    df["temp_score"] = df["temperature_2m_max"] / 45.0
    df["wind_score"] = df["wind_speed_10m_max"] / 60.0

    # Step 2 — Duration scores (compounding risk over rolling windows)
    df["rolling_7d_rain"]     = df["precipitation_sum"].rolling(window=7, min_periods=1).sum()
    df["rolling_3d_temp"]     = df["temperature_2m_max"].rolling(window=3, min_periods=1).mean()
    df["rain_duration_score"] = df["rolling_7d_rain"] / 200.0
    df["heat_duration_score"] = df["rolling_3d_temp"] / 45.0

    # Step 3 — Environmental stress proxy (0=clear sky, 1=fully overcast)
    df["humidity_proxy"] = (1 - (df["shortwave_radiation_sum"] / max_rad)).clip(0, 1)

    # Step 4 — Weighted composite
    df["raw_risk_score"] = (
        0.35 * df["rain_score"].clip(0, 1)          +
        0.15 * df["rain_duration_score"].clip(0, 1) +
        0.20 * df["temp_score"].clip(0, 1)          +
        0.10 * df["heat_duration_score"].clip(0, 1) +
        0.10 * df["wind_score"].clip(0, 1)          +
        0.10 * df["humidity_proxy"]
    )

    # Step 5 — Non-linear amplification
    # 0.4^1.5 ≈ 0.25 (mild day dampened) | 0.9^1.5 ≈ 0.85 (severe amplified)
    df["risk_score"] = df["raw_risk_score"] ** 1.5

    # Step 6 — Disruption probability
    df["disruption_prob"] = df["risk_score"].clip(0, 1.0)

    # Step 7 — Binary payout trigger
    df["disruption_occurred"] = (df["disruption_prob"] > TRIGGER_THRESHOLD).astype(int)

    return df


def compute_income_and_loss(df: pd.DataFrame, city: str) -> pd.DataFrame:
    """
    Dynamic income model + smooth loss fraction.
    All outputs are Layer 1 — business logic + reporting only.
    NEVER feed these into the ML feature matrix.
    """
    base_income = CITY_INCOME_MAP.get(city, 800)

    # Weather-derived variation (deterministic — no random())
    df["demand_factor"]   = 1.0 + (0.30 * df["disruption_prob"])
    df["worker_factor"]   = 1.0 - (0.25 * df["disruption_prob"])
    df["seasonal_factor"] = df["date"].dt.month.apply(
        lambda m: 1.1 if m in [6, 7, 8, 9] else 1.0
    )

    df["daily_income_inr"] = (
        base_income
        * df["demand_factor"]
        * df["worker_factor"]
        * df["seasonal_factor"]
    ).round(2)

    # Smooth clip ramp: prob < 0.3 → zero loss | prob = 1.0 → 100% loss
    df["loss_fraction"] = np.clip((df["disruption_prob"] - 0.3) / 0.7, 0, 1)

    df["expected_loss_inr"] = (df["loss_fraction"] * df["daily_income_inr"]).round(2)

    return df


def add_interaction_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cross-feature interactions computed from raw inputs only — no leakage risk.

    rain_wind_interaction : storm events (heavy rain + sustained wind)
    rain_temp_interaction : humidity stress (rain + heat = work-stopping conditions)

    These go into the ML matrix. If feature importance returns ~0 for either,
    they are not adding signal → drop them in the next iteration.
    """
    df["rain_wind_interaction"] = df["precipitation_sum"] * df["wind_speed_10m_max"]
    df["rain_temp_interaction"] = df["precipitation_sum"] * df["temperature_2m_max"]
    return df


# ─────────────────────────────────────────────────────────────────────────────
# ══ LAYER 2 — ML FEATURE MATRIX ══════════════════════════════════════════════
# Rule     : No derived/simulation columns — they all leak disruption_prob
#            back into the feature space
# ─────────────────────────────────────────────────────────────────────────────

RAW_WEATHER_FEATURES = [
    "precipitation_sum",
    "temperature_2m_max",
    "wind_speed_10m_max",
    "apparent_temperature_max",
    "precipitation_hours",
    "wind_gusts_10m_max",
    "shortwave_radiation_sum",
]

DURATION_FEATURES = [
    "rolling_7d_rain",
    "rolling_3d_temp",
]

TIME_FEATURES = [
    "sin_time",
    "cos_time",
    "seasonal_factor",  # calendar-derived, not weather-derived → safe
]

INTERACTION_FEATURES = [
    "rain_wind_interaction",
    "rain_temp_interaction",
]

# Version A — pure ML (zero leakage, max generalizability)
FEATURES_PURE = (
    RAW_WEATHER_FEATURES
    + DURATION_FEATURES
    + TIME_FEATURES
    + INTERACTION_FEATURES
)

# Version B — hybrid ML (adds hand-crafted risk signal)
# risk_score is safe as a feature when TARGET = expected_loss_inr
# because risk_score is not derived from expected_loss_inr.
# In practice, GBM can use it as a shortcut and converge faster.
# Compare R² of both — use whichever generalizes better on holdout.
FEATURES_HYBRID = FEATURES_PURE + ["risk_score"]

TARGET = "expected_loss_inr"

ML_EXCLUDED_COLUMNS = [
    "demand_factor", "worker_factor", "loss_fraction",
    "disruption_prob", "raw_risk_score",
    "rain_score", "temp_score", "wind_score",
    "rain_duration_score", "heat_duration_score",
    "humidity_proxy",      # derived from shortwave_radiation_sum already in features
    "daily_income_inr",    # f(disruption_prob) → leaks target
]


def build_ml_matrix(daily_df: pd.DataFrame, feature_set: list, label: str) -> pd.DataFrame:
    """
    Builds clean ML-ready dataframe.

    Steps:
      1. Select features + targets + reference cols
      2. Sort by [city, date] — ensures per-city temporal ordering
         Global sort alone causes cross-city leakage
      3. One-hot encode city (integer encoding implies fake ordinal ordering)
      4. Leakage check — warns if any excluded columns slipped in
    """
    keep_cols = (
        ["date", "city"]
        + [f for f in feature_set if f in daily_df.columns]
        + [TARGET, "disruption_occurred"]
    )
    ml_df = daily_df[keep_cols].copy()

    # Sort by city then date — critical for time-based split
    ml_df = ml_df.sort_values(["city", "date"]).reset_index(drop=True)

    # One-hot encode city — no ordinal ordering implied
    ml_df = pd.get_dummies(ml_df, columns=["city"], prefix="city")

    # Leakage check
    leaked = [c for c in ML_EXCLUDED_COLUMNS if c in ml_df.columns]
    if leaked:
        print(f"  ⚠️  [{label}] LEAKAGE WARNING — {leaked}")
    else:
        print(f"  ✅ [{label}] Leakage check passed — {len(feature_set)} features clean")

    return ml_df


def time_split(ml_df: pd.DataFrame):
    """
    Fixed date cutoff split — more realistic than 80/20 shuffle.

    train = 2015–2022  (known past, 8 years)
    test  = 2023–2025  (truly unseen future, 3 years)

    The sort_values(["city","date"]) in build_ml_matrix guarantees
    each city's rows are contiguous and ordered before this split runs.
    """
    train = ml_df[ml_df["date"] <= TRAIN_END_DATE].copy()
    test  = ml_df[ml_df["date"] >= TEST_START_DATE].copy()
    return train, test


# ─────────────────────────────────────────────────────────────────────────────
# ══ EVALUATION ENGINE ════════════════════════════════════════════════════════
# ─────────────────────────────────────────────────────────────────────────────

def get_feature_cols(ml_df: pd.DataFrame, feature_set: list) -> list:
    """Returns the actual columns present in ml_df from feature_set + one-hot city cols."""
    numeric  = [f for f in feature_set if f in ml_df.columns]
    city_ohe = [c for c in ml_df.columns if c.startswith("city_")]
    return numeric + city_ohe


def train_model(X_train, y_train) -> GradientBoostingRegressor:
    """
    GradientBoostingRegressor — chosen because:
      - Handles non-linear relationships (our risk signal is non-linear by design)
      - No scaling needed (tree splits on thresholds, not distances)
      - Gives feature importances for interpretability + validation
    """
    model = GradientBoostingRegressor(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=4,
        min_samples_leaf=20,
        random_state=42,
    )
    model.fit(X_train, y_train)
    return model


def overfit_check(train_r2: float, test_r2: float) -> str:
    """
    Gap interpretation:
      < 0.05   → excellent generalization
      0.05–0.1 → acceptable
      > 0.1    → overfitting — reduce max_depth or increase min_samples_leaf
    """
    gap = train_r2 - test_r2
    if gap < 0.05:
        status = "✅ excellent"
    elif gap < 0.10:
        status = "⚠️  acceptable"
    else:
        status = "🔴 overfitting"
    return f"{gap:.4f}  ({status})"


def walk_forward_cv(ml_df: pd.DataFrame, feature_set: list, label: str) -> list:
    """
    Walk-forward (expanding window) cross-validation.

    Each fold expands the training window by 1 year.
    Test window = the following year only (no lookahead).

    Fold structure:
      Fold 1: Train 2015–2018 | Test 2019
      Fold 2: Train 2015–2019 | Test 2020
      Fold 3: Train 2015–2020 | Test 2021
      Fold 4: Train 2015–2021 | Test 2022
      Fold 5: Train 2015–2022 | Test 2023

    Why this matters:
      Single train-test split gives one R² number that could be lucky/unlucky.
      Walk-forward gives 5 independent R² values → stable, credible estimate.
      If R² improves fold-over-fold → model benefits from more historical data.
      If R² is volatile → model is sensitive to specific years (e.g. COVID 2020).
    """
    feature_cols = get_feature_cols(ml_df, feature_set)
    fold_results = []

    print(f"\n  📅 Walk-forward CV [{label}]")
    print(f"  {'Fold':<6} {'Train end':<14} {'Test year':<12} {'R²':>8} {'MAE':>10} {'Gap':>10}")
    print(f"  {'─'*60}")

    for i, fold in enumerate(WALKFORWARD_FOLDS, 1):
        fold_train = ml_df[ml_df["date"] <= fold["train_end"]]
        fold_test  = ml_df[
            (ml_df["date"] >= fold["test_start"]) &
            (ml_df["date"] <= fold["test_end"])
        ]

        if len(fold_train) == 0 or len(fold_test) == 0:
            continue

        X_tr = fold_train[feature_cols].fillna(0).values
        y_tr = fold_train[TARGET].values
        X_te = fold_test[feature_cols].fillna(0).values
        y_te = fold_test[TARGET].values

        model   = train_model(X_tr, y_tr)
        y_pred  = model.predict(X_te)

        fold_r2  = r2_score(y_te, y_pred)
        fold_mae = mean_absolute_error(y_te, y_pred)
        tr_r2    = r2_score(y_tr, model.predict(X_tr))
        gap      = tr_r2 - fold_r2

        print(
            f"  {i:<6} {fold['train_end']:<14} "
            f"{fold['test_start'][:4]:<12} "
            f"{fold_r2:>8.4f} "
            f"₹{fold_mae:>8.2f} "
            f"{gap:>10.4f}"
        )

        fold_results.append({
            "fold": i, "train_end": fold["train_end"],
            "test_year": fold["test_start"][:4],
            "r2": fold_r2, "mae": fold_mae,
            "train_r2": tr_r2, "gap": gap,
        })

    avg_r2  = np.mean([r["r2"]  for r in fold_results])
    avg_mae = np.mean([r["mae"] for r in fold_results])
    print(f"  {'─'*60}")
    print(f"  {'AVG':<6} {'':14} {'':12} {avg_r2:>8.4f} ₹{avg_mae:>8.2f}")

    return fold_results


def evaluate_model(
    ml_df: pd.DataFrame,
    feature_set: list,
    label: str,
) -> dict:
    """
    Full evaluation:
      1. Time-based split (2015–2022 train | 2023–2025 test)
      2. Train GBM — no scaling (tree model, removes scaler leakage risk)
      3. Train R² vs Test R² → overfit check
      4. Feature importance → export + validate interaction features
      5. Walk-forward CV → stable R² estimate across 5 folds
    """
    print(f"\n  🔧 Evaluating [{label}]  ({len(feature_set)} features)...")

    feature_cols = get_feature_cols(ml_df, feature_set)
    train_df, test_df = time_split(ml_df)

    X_train = train_df[feature_cols].fillna(0).values
    y_train = train_df[TARGET].values
    X_test  = test_df[feature_cols].fillna(0).values
    y_test  = test_df[TARGET].values

    # Train — no StandardScaler
    # Reason: GBM splits on thresholds, not distances → scaling has no effect
    # on split quality. Removing scaler also eliminates risk of accidentally
    # fitting on train+test together (a subtle leakage vector).
    model   = train_model(X_train, y_train)

    y_pred_train = model.predict(X_train)
    y_pred_test  = model.predict(X_test)

    train_r2 = r2_score(y_train, y_pred_train)
    test_r2  = r2_score(y_test,  y_pred_test)
    test_mae = mean_absolute_error(y_test, y_pred_test)
    gap_str  = overfit_check(train_r2, test_r2)

    print(f"     Train R²  : {train_r2:.4f}")
    print(f"     Test  R²  : {test_r2:.4f}")
    print(f"     Overfit   : {gap_str}")
    print(f"     MAE       : ₹{test_mae:.2f}/day")

    # Feature importances
    importance_df = pd.DataFrame({
        "feature":    feature_cols,
        "importance": model.feature_importances_,
    }).sort_values("importance", ascending=False)

    importance_df.to_csv(f"feature_importance_{label}.csv", index=False)

    # Validate interaction features — if near-zero, they're not adding signal
    for feat in INTERACTION_FEATURES:
        match = importance_df[importance_df["feature"] == feat]
        if not match.empty:
            imp = match["importance"].values[0]
            flag = "✅" if imp > 0.01 else "⚠️  near-zero → consider dropping"
            print(f"     {feat}: {imp:.4f}  {flag}")

    # Walk-forward CV
    fold_results = walk_forward_cv(ml_df, feature_set, label)

    return {
        "label":        label,
        "train_r2":     train_r2,
        "test_r2":      test_r2,
        "test_mae":     test_mae,
        "gap_str":      gap_str,
        "top_features": importance_df.head(10),
        "fold_results": fold_results,
        "model":        model,
        "feature_cols": feature_cols,
    }


def write_evaluation_report(results: list, daily_df: pd.DataFrame, path: str):
    """Writes plain-text report comparing pure vs hybrid + fold summary."""
    lines = []
    lines.append("=" * 65)
    lines.append("  DISRUPTION PIPELINE — MODEL EVALUATION REPORT")
    lines.append("  AAITA Labs | Parametric Insurance for Gig Workers")
    lines.append("=" * 65)
    lines.append(f"  Target    : {TARGET}")
    lines.append(f"  Model     : GradientBoostingRegressor")
    lines.append(f"  Train     : 2015–2022  |  Test: 2023–2025")
    lines.append(f"  CV        : Walk-forward, {len(WALKFORWARD_FOLDS)} folds (expanding window)")
    lines.append("")

    for r in results:
        lines.append("-" * 65)
        lines.append(f"  VERSION   : {r['label'].upper()}")
        lines.append(f"  Features  : {len(r['feature_cols'])}")
        lines.append(f"  Train R²  : {r['train_r2']:.4f}")
        lines.append(f"  Test  R²  : {r['test_r2']:.4f}")
        lines.append(f"  Overfit   : {r['gap_str']}")
        lines.append(f"  MAE       : ₹{r['test_mae']:.2f} per day")
        lines.append("")
        lines.append("  Top 10 Feature Importances:")
        for _, row in r["top_features"].iterrows():
            bar = "█" * int(row["importance"] * 100)
            lines.append(f"    {row['feature']:<38} {row['importance']:.4f}  {bar}")
        lines.append("")
        lines.append("  Walk-forward CV Folds:")
        lines.append(f"    {'Fold':<6} {'Test Year':<12} {'R²':>8} {'MAE':>10} {'Gap':>10}")
        for fold in r["fold_results"]:
            lines.append(
                f"    {fold['fold']:<6} {fold['test_year']:<12} "
                f"{fold['r2']:>8.4f} ₹{fold['mae']:>8.2f} {fold['gap']:>10.4f}"
            )
        avg_r2  = np.mean([f["r2"]  for f in r["fold_results"]])
        avg_mae = np.mean([f["mae"] for f in r["fold_results"]])
        lines.append(f"    {'AVG':<6} {'':<12} {avg_r2:>8.4f} ₹{avg_mae:>8.2f}")
        lines.append("")

    lines.append("=" * 65)
    best = max(results, key=lambda x: x["test_r2"])
    lines.append(f"  ✅ RECOMMENDED : {best['label'].upper()}")
    lines.append(f"     Test R² = {best['test_r2']:.4f}  |  MAE = ₹{best['test_mae']:.2f}/day")
    lines.append("")
    lines.append("  Interpretation:")
    lines.append("    R² > 0.90         → excellent (model explains variance well)")
    lines.append("    R² 0.75–0.90      → good (acceptable for pricing)")
    lines.append("    R² < 0.75         → review features or add more data")
    lines.append("    Overfit gap < 0.05 → excellent generalization")
    lines.append("    Overfit gap > 0.10 → reduce max_depth / increase min_samples_leaf")
    lines.append("=" * 65)

    with open(path, "w") as f:
        f.write("\n".join(lines))

    print("\n" + "\n".join(lines))


# ─────────────────────────────────────────────────────────────────────────────
# 📅  WEEKLY PREDICTION
# ─────────────────────────────────────────────────────────────────────────────

def predict_weekly(
    daily_df: pd.DataFrame,
    best_result: dict,
    ml_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Correct pipeline: predict daily → aggregate to weekly.

    Why not predict directly on weekly features:
      Model was trained on daily rows with daily feature distributions.
      Weekly aggregates have different statistical properties (sums, maxes).
      Predicting on weekly would be applying the model out-of-distribution.

    Steps:
      1. Predict expected_loss_inr for every daily row
      2. Aggregate predictions to weekly using W-MON resample
         (sum of daily predicted losses = weekly predicted loss)
      3. Derive premium estimate = weekly predicted loss × safety_margin
         Safety margin 1.25 = 25% buffer above expected loss (industry convention)
    """
    feature_cols = best_result["feature_cols"]
    model        = best_result["model"]

    X_all = ml_df[feature_cols].fillna(0).values
    ml_df = ml_df.copy()
    ml_df["predicted_loss_inr"] = model.predict(X_all).clip(0)

    # Aggregate daily predictions → weekly
    weekly_pred_list = []
    for city in CITIES.keys():
        city_sub = ml_df[ml_df.get("city", None) is None or True].copy()

        # Find city column from one-hot
        city_col = f"city_{city}"
        if city_col in ml_df.columns:
            city_sub = ml_df[ml_df[city_col] == 1].copy()
        else:
            continue

        city_sub = city_sub[["date", "predicted_loss_inr"]].copy()
        city_sub.set_index("date", inplace=True)
        weekly_city = city_sub.resample("W-MON").agg(
            predicted_loss_inr=("predicted_loss_inr", "sum")
        ).reset_index()
        weekly_city["city"] = city
        weekly_pred_list.append(weekly_city)

    weekly_pred_df = pd.concat(weekly_pred_list, ignore_index=True)

    # Premium estimate: expected loss + 25% safety margin
    # In parametric insurance, premium >= E[loss] to remain solvent
    # Adjust margin based on city risk tier and product design
    weekly_pred_df["estimated_premium_inr"] = (
        weekly_pred_df["predicted_loss_inr"] * 1.25
    ).round(2)

    return weekly_pred_df


# ─────────────────────────────────────────────────────────────────────────────
# 🚀  MAIN PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

def generate_datasets():
    print("╔══════════════════════════════════════════════════════╗")
    print("║   AAITA Labs — Disruption Pipeline v3 (Final)       ║")
    print("╚══════════════════════════════════════════════════════╝")
    print(f"\n  Cities          : {len(CITIES)}")
    print(f"  Date range      : 2015-01-01 → 2025-12-31")
    print(f"  Trigger         : disruption_prob > {TRIGGER_THRESHOLD}")
    print(f"  Train period    : 2015 → {TRAIN_END_DATE}")
    print(f"  Test period     : {TEST_START_DATE} → 2025-12-31")
    print(f"  Pure features   : {len(FEATURES_PURE)}")
    print(f"  Hybrid features : {len(FEATURES_HYBRID)}\n")

    start_date = "2015-01-01"
    end_date   = "2025-12-31"
    url        = "https://archive-api.open-meteo.com/v1/archive"

    all_city_data = []

    for city, coords in CITIES.items():
        print(f"  ↳ Fetching: {city}...")

        params = {
            "latitude":   coords["lat"],
            "longitude":  coords["lon"],
            "start_date": start_date,
            "end_date":   end_date,
            "daily": [
                "temperature_2m_max",       # 0
                "apparent_temperature_max", # 1
                "precipitation_sum",        # 2
                "rain_sum",                 # 3
                "precipitation_hours",      # 4
                "wind_speed_10m_max",       # 5
                "wind_gusts_10m_max",       # 6
                "shortwave_radiation_sum",  # 7
            ],
            "timezone": "Asia/Kolkata",
        }

        try:
            responses = openmeteo.weather_api(url, params=params)
            response  = responses[0]
            daily     = response.Daily()

            date_range = pd.date_range(
                start=pd.to_datetime(daily.Time(),    unit="s", utc=True),
                end=pd.to_datetime(daily.TimeEnd(),   unit="s", utc=True),
                freq=pd.Timedelta(seconds=daily.Interval()),
                inclusive="left",
            )

            city_df = pd.DataFrame({
                "date":                     date_range.tz_convert("Asia/Kolkata").dt.date,
                "city":                     city,
                "temperature_2m_max":       daily.Variables(0).ValuesAsNumpy(),
                "apparent_temperature_max": daily.Variables(1).ValuesAsNumpy(),
                "precipitation_sum":        daily.Variables(2).ValuesAsNumpy(),
                "rain_sum":                 daily.Variables(3).ValuesAsNumpy(),
                "precipitation_hours":      daily.Variables(4).ValuesAsNumpy(),
                "wind_speed_10m_max":       daily.Variables(5).ValuesAsNumpy(),
                "wind_gusts_10m_max":       daily.Variables(6).ValuesAsNumpy(),
                "shortwave_radiation_sum":  daily.Variables(7).ValuesAsNumpy(),
            })

            city_df["date"] = pd.to_datetime(city_df["date"])

            # Cyclical encoding — day 365 ≈ day 1, not far apart
            day_of_year          = city_df["date"].dt.dayofyear
            city_df["sin_time"]  = np.sin(2 * np.pi * day_of_year / 365.25)
            city_df["cos_time"]  = np.cos(2 * np.pi * day_of_year / 365.25)

            # Layer 1
            city_df = compute_disruption_features(city_df, city)
            city_df = compute_income_and_loss(city_df, city)
            city_df = add_interaction_features(city_df)

            all_city_data.append(city_df)

        except Exception as e:
            print(f"  ⚠️  Error for {city}: {e}")

    daily_df = pd.concat(all_city_data, ignore_index=True)

    # ── Output 1: Full daily ──────────────────────────────────────────────────
    daily_path = "historical_daily_risk_pipeline.csv"
    daily_df.to_csv(daily_path, index=False)
    print(f"\n✅ OUTPUT 1 — Full daily dataset")
    print(f"   Rows  : {len(daily_df):,}  |  Cols: {len(daily_df.columns)}")
    print(f"   Saved : {daily_path}")

    # ── Output 2: Weekly actuarial ────────────────────────────────────────────
    print("\n⏳ Aggregating to weekly format...")
    weekly_agg = {
        "temperature_2m_max":         "mean",
        "apparent_temperature_max":   "max",
        "precipitation_sum":          "sum",
        "wind_speed_10m_max":         "max",
        "shortwave_radiation_sum":    "mean",
        "rolling_7d_rain":            "max",
        "rolling_3d_temp":            "max",
        "rain_wind_interaction":      "max",
        "rain_temp_interaction":      "max",
        "disruption_occurred":        "max",
        "disruption_prob":            "max",
        "risk_score":                 "mean",
        "loss_fraction":              "mean",
        "daily_income_inr":           "mean",
        "expected_loss_inr":          "sum",
        "humidity_proxy":             "mean",
    }

    weekly_list = []
    for city in CITIES.keys():
        city_sub = daily_df[daily_df["city"] == city].copy()
        city_sub.set_index("date", inplace=True)
        weekly_city = city_sub.resample("W-MON").agg(weekly_agg).reset_index()
        weekly_city["city"] = city
        weekly_list.append(weekly_city)

    weekly_df = pd.concat(weekly_list, ignore_index=True)
    weekly_path = "historical_weekly_business_logic.csv"
    weekly_df.to_csv(weekly_path, index=False)
    print(f"✅ OUTPUT 2 — Weekly actuarial dataset")
    print(f"   Rows  : {len(weekly_df):,}  |  Saved: {weekly_path}")

    # ── Output 3 + 4: ML matrices ─────────────────────────────────────────────
    print("\n🧠 Building ML feature matrices...")
    ml_pure   = build_ml_matrix(daily_df, FEATURES_PURE,   "pure")
    ml_hybrid = build_ml_matrix(daily_df, FEATURES_HYBRID, "hybrid")

    ml_pure.to_csv("ml_features_pure.csv",   index=False)
    ml_hybrid.to_csv("ml_features_hybrid.csv", index=False)
    print(f"   Saved : ml_features_pure.csv  |  ml_features_hybrid.csv")

    # ── Output 5: Evaluation + CV ─────────────────────────────────────────────
    print("\n📊 Running model evaluation + walk-forward CV...")
    results = [
        evaluate_model(ml_pure,   FEATURES_PURE,   "pure"),
        evaluate_model(ml_hybrid, FEATURES_HYBRID, "hybrid"),
    ]

    eval_path = "evaluation_report.txt"
    write_evaluation_report(results, daily_df, eval_path)
    print(f"\n✅ OUTPUT 5 — Evaluation report saved: {eval_path}")
    print(f"   Also saved: feature_importance_pure.csv  |  feature_importance_hybrid.csv")

    # ── Output 6: Weekly predictions ─────────────────────────────────────────
    print("\n📅 Generating weekly predictions (daily → aggregate)...")
    best_result = max(results, key=lambda x: x["test_r2"])
    best_ml_df  = ml_pure if best_result["label"] == "pure" else ml_hybrid

    weekly_pred_df = predict_weekly(daily_df, best_result, best_ml_df)
    weekly_pred_path = "weekly_with_predictions.csv"
    weekly_pred_df.to_csv(weekly_pred_path, index=False)
    print(f"✅ OUTPUT 6 — Weekly predictions saved: {weekly_pred_path}")
    print(f"   Columns: date, city, predicted_loss_inr, estimated_premium_inr")

    # ── Sanity checks ─────────────────────────────────────────────────────────
    print("\n" + "─" * 58)
    print("📊  DISRUPTION RATE BY CITY  (% days above trigger)")
    print("─" * 58)
    rates = (
        daily_df.groupby("city")["disruption_occurred"]
        .mean().mul(100).round(2)
        .sort_values(ascending=False)
    )
    for city, rate in rates.items():
        bar = "█" * int(rate / 2)
        print(f"  {city:<12}  {rate:5.2f}%  {bar}")

    print("\n" + "─" * 58)
    print("💰  AVG EXPECTED LOSS + PREMIUM BY CITY  (INR/week)")
    print("─" * 58)
    city_summary = (
        weekly_pred_df.groupby("city")[["predicted_loss_inr", "estimated_premium_inr"]]
        .mean().round(2)
        .sort_values("predicted_loss_inr", ascending=False)
    )
    for city, row in city_summary.iterrows():
        print(f"  {city:<12}  Loss: ₹{row['predicted_loss_inr']:>8.2f}  "
              f"Premium: ₹{row['estimated_premium_inr']:>8.2f}")

    print("\n🏁 Pipeline complete.\n")


if __name__ == "__main__":
    generate_datasets()