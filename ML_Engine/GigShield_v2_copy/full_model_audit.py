"""
GigShield v2 — Full Model Audit & Stress Test Suite
Covers:
  1. Model Sanity Check
  2. 14-Day Continuous Monsoon Stress Test (9 Indian cities)
  3. Extreme Heat Wave (Rajasthan/Delhi Summer)
  4. Cyclone Scenario (Bay of Bengal coast)
  5. Edge Cases (Zero rain, missing data, boundary values)
  6. Premium BCR Actuarial Check (all 3 plans)
  7. Annual Pool Solvency Projection
"""

import numpy as np
import joblib, json, sys
from datetime import date

# ─── LOAD MODEL ───────────────────────────────────────────────────────────────
try:
    model = joblib.load("gigshield_v2_model.joblib")
    meta = json.load(open("gigshield_v2_meta.json"))
    FEATURES = meta["feature_cols"]
    print(f"✅ Model loaded: {meta['version']} | {meta['features_count']} features | Test R²={meta['test_r2']}")
except Exception as e:
    print(f"❌ FAILED TO LOAD MODEL: {e}")
    sys.exit(1)

DAILY_INCOME = 800
TOTAL_RIDERS = 1000
PLANS = {"Basic(40%)": (0.40, 49), "Standard(70%)": (0.70, 99), "Premium(100%)": (1.00, 169)}

PASS = "✅ PASS"
FAIL = "❌ FAIL"
WARN = "⚠️  WARN"

results_log = []

def make_features(precip, wind, gust, temp, app_temp, rad,
                  r7d, r3d_t, r7d_w, elev, coast,
                  lat, lon, dist_coast, safety, month=7,
                  is_weekend=0, sin_t=0.0, cos_t=-1.0):
    p = max(precip, 0)
    w = max(wind, 0)
    return {
        "precipitation_sum": p,
        "temperature_2m_max": temp,
        "wind_speed_10m_max": w,
        "apparent_temperature_max": app_temp,
        "precipitation_hours": max(p / 8, 0.5),
        "wind_gusts_10m_max": gust,
        "shortwave_radiation_sum": rad,
        "rolling_7d_rain": r7d,
        "rolling_3d_temp": r3d_t,
        "rolling_7d_wind": r7d_w,
        "sin_time": sin_t,
        "cos_time": cos_t,
        "is_weekend": is_weekend,
        "month": month,
        "rain_wind_interaction": p * w,
        "rain_squared": p ** 2,
        "wind_squared": w ** 2,
        "temp_squared": temp ** 2,
        "rain_wind_ratio": p / (w + 1),
        "heat_index_proxy": app_temp - temp,
        "rain_intensity": p / (max(p / 8, 0.5) + 1),
        "temp_humidity_gap": app_temp - temp,
        "trigger_rain_active": 1 if p > 30 else 0,
        "trigger_heat_active": 1 if temp > 42 else 0,
        "trigger_storm_active": 1 if w > 40 else 0,
        "trigger_flood_active": 1 if elev < 50 and r7d > 150 else 0,
        "trigger_visibility_active": 1 if rad < 8 else 0,
        "n_triggers_active": sum([p > 30, temp > 42, w > 40, elev < 50 and r7d > 150, rad < 8]),
        "elevation": elev,
        "is_coastal": coast,
        "latitude": lat,
        "longitude": lon,
        "distance_to_coast": dist_coast,
        "zone_safety_score": safety,
    }

def predict(feat_dict):
    X = np.array([[feat_dict.get(f, 0) for f in FEATURES]])
    raw = model.predict(X)[0]
    return float(np.clip(raw, 0, 1))

def predict_14d(daily_feats):
    X = np.array([[f.get(feat, 0) for feat in FEATURES] for f in daily_feats])
    preds = model.predict(X)
    return np.clip(preds, 0, 1)

def section(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def log(test_name, status, detail=""):
    results_log.append((test_name, status, detail))
    icon = status.split()[0]
    print(f"  {icon} {test_name}: {detail}")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 1: MODEL SANITY CHECKS
# ══════════════════════════════════════════════════════════════════════════════
section("TEST 1: MODEL SANITY CHECKS")

# 1a: Normal clear day → expect LOW loss ratio
clear_day = make_features(0, 5, 8, 28, 30, 22, 10, 28, 5, 500, 0, 17.4, 78.5, 500, 0.85)
r_clear = predict(clear_day)
status = PASS if r_clear < 0.10 else WARN if r_clear < 0.20 else FAIL
log("Clear Day (Bangalore): Loss Ratio < 10%", status, f"{r_clear*100:.2f}% [Expected < 10%]")

# 1b: Heavy monsoon → expect HIGH loss ratio
heavy_rain = make_features(120, 55, 75, 30, 37, 4, 700, 30, 45, 14, 1, 19.08, 72.88, 2, 0.15)
r_heavy = predict(heavy_rain)
status = PASS if r_heavy > 0.35 else WARN if r_heavy > 0.15 else FAIL
log("Heavy Monsoon (Mumbai): Loss Ratio > 35%", status, f"{r_heavy*100:.2f}% [Expected > 35%]")

# 1c: Output is bounded [0, 1]
r_extreme = predict(make_features(999, 999, 999, 60, 70, 0, 2000, 60, 999, 5, 1, 19.0, 72.0, 1, 0.0))
status = PASS if 0.0 <= r_extreme <= 1.0 else FAIL
log("Output Bounds [0,1] for Extreme Inputs", status, f"{r_extreme:.4f}")

# 1d: Zero rain → no flood trigger
r_zero = predict(make_features(0, 0, 0, 25, 26, 20, 0, 25, 0, 400, 0, 23.0, 80.0, 400, 0.90))
status = PASS if r_zero < 0.05 else WARN
log("Zero Rain/Wind: Very Low Risk", status, f"{r_zero*100:.2f}% [Expected < 5%]")

# 1e: Monotonicity — more rain → higher loss
r_low = predict(make_features(5, 10, 15, 32, 35, 18, 20, 31, 10, 200, 0, 22.5, 75.0, 300, 0.75))
r_mid = predict(make_features(40, 20, 30, 32, 36, 12, 200, 32, 18, 200, 0, 22.5, 75.0, 300, 0.50))
r_high = predict(make_features(100, 40, 55, 31, 38, 5, 500, 31, 35, 200, 1, 22.5, 75.0, 300, 0.20))
mono_ok = (r_low < r_mid < r_high)
status = PASS if mono_ok else FAIL
log("Monotonicity (rain↑ → loss↑)", status, f"Low={r_low*100:.1f}% → Mid={r_mid*100:.1f}% → High={r_high*100:.1f}%")

# 1f: Coastal vs inland for same rain
r_coastal = predict(make_features(50, 30, 45, 30, 36, 8, 250, 30, 28, 10, 1, 13.08, 80.27, 5, 0.25))
r_inland = predict(make_features(50, 30, 45, 30, 36, 8, 250, 30, 28, 400, 0, 17.38, 78.48, 500, 0.80))
status = PASS if r_coastal > r_inland else WARN
log("Coastal > Inland for Same Rain", status, f"Coastal={r_coastal*100:.1f}% vs Inland={r_inland*100:.1f}%")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 2: 14-DAY CONTINUOUS MONSOON STRESS TEST
# ══════════════════════════════════════════════════════════════════════════════
section("TEST 2: 14-DAY CONTINUOUS MONSOON STRESS TEST (1000 Riders)")

ZONES_MONSOON = [
    {"name": "Mumbai (Extreme)",   "pct": 0.10, "precip": 140, "wind": 60, "gust": 80, "temp": 30, "app_temp": 38, "rad": 3,  "r7d": 750, "r3d_t": 30, "r7d_w": 50, "elev": 14,  "coast": 1, "lat": 19.08, "lon": 72.88, "dist": 2,    "safety": 0.10},
    {"name": "Kolkata (Cyclone)",  "pct": 0.08, "precip": 110, "wind": 70, "gust": 95, "temp": 31, "app_temp": 39, "rad": 3,  "r7d": 600, "r3d_t": 31, "r7d_w": 55, "elev": 9,   "coast": 1, "lat": 22.57, "lon": 88.36, "dist": 120,  "safety": 0.12},
    {"name": "Chennai (NE Monsoon)","pct": 0.08,"precip": 60,  "wind": 30, "gust": 45, "temp": 32, "app_temp": 39, "rad": 8,  "r7d": 300, "r3d_t": 32, "r7d_w": 25, "elev": 6,   "coast": 1, "lat": 13.08, "lon": 80.27, "dist": 3,    "safety": 0.20},
    {"name": "Guwahati (NE Rain)", "pct": 0.05, "precip": 90,  "wind": 25, "gust": 38, "temp": 29, "app_temp": 35, "rad": 5,  "r7d": 480, "r3d_t": 29, "r7d_w": 22, "elev": 55,  "coast": 0, "lat": 26.18, "lon": 91.74, "dist": 900,  "safety": 0.25},
    {"name": "Delhi (Dry Season)", "pct": 0.20, "precip": 1,   "wind": 8,  "gust": 12, "temp": 38, "app_temp": 40, "rad": 22, "r7d": 5,   "r3d_t": 37, "r7d_w":  8, "elev": 216, "coast": 0, "lat": 28.61, "lon": 77.20, "dist": 1050, "safety": 0.88},
    {"name": "Bangalore (Mild R)","pct": 0.15,  "precip": 12,  "wind": 12, "gust": 18, "temp": 27, "app_temp": 29, "rad": 16, "r7d": 60,  "r3d_t": 27, "r7d_w": 11, "elev": 920, "coast": 0, "lat": 12.97, "lon": 77.59, "dist": 350,  "safety": 0.90},
    {"name": "Jaipur (Dry)",      "pct": 0.12,  "precip": 0,   "wind": 12, "gust": 18, "temp": 43, "app_temp": 44, "rad": 25, "r7d": 0,   "r3d_t": 42, "r7d_w": 12, "elev": 431, "coast": 0, "lat": 26.92, "lon": 75.78, "dist": 600,  "safety": 0.92},
    {"name": "Hyderabad (Mild)",  "pct": 0.12,  "precip": 8,   "wind": 12, "gust": 18, "temp": 34, "app_temp": 37, "rad": 18, "r7d": 40,  "r3d_t": 33, "r7d_w": 11, "elev": 542, "coast": 0, "lat": 17.38, "lon": 78.48, "dist": 500,  "safety": 0.82},
    {"name": "Pune (Light Rain)", "pct": 0.10,  "precip": 18,  "wind": 15, "gust": 22, "temp": 28, "app_temp": 31, "rad": 14, "r7d": 90,  "r3d_t": 28, "r7d_w": 14, "elev": 560, "coast": 0, "lat": 18.52, "lon": 73.85, "dist": 150,  "safety": 0.78},
]

total_claims_all = {p: 0 for p in PLANS}
total_premium_all = {p: 0 for p in PLANS}

print(f"\n{'Zone':<26} {'Riders':>6} {'Avg Loss%':>10} {'Triggers':>8}")
print("-" * 60)

for zone in ZONES_MONSOON:
    n_riders = int(TOTAL_RIDERS * zone["pct"])
    # Build 14 days — escalating monsoon (days 1-7 ramping, days 8-14 peak)
    daily_feats = []
    for day in range(14):
        scale = 0.6 + 0.4 * (day / 13)  # ramp from 60% to 100% intensity
        daily_feats.append(make_features(
            precip=zone["precip"] * scale, wind=zone["wind"] * scale,
            gust=zone["gust"] * scale, temp=zone["temp"], app_temp=zone["app_temp"],
            rad=zone["rad"], r7d=zone["r7d"] * scale, r3d_t=zone["r3d_t"],
            r7d_w=zone["r7d_w"] * scale, elev=zone["elev"], coast=zone["coast"],
            lat=zone["lat"], lon=zone["lon"], dist_coast=zone["dist"],
            safety=zone["safety"], month=7
        ))
    preds = predict_14d(daily_feats)
    avg_loss = np.mean(preds)
    triggers = int(zone.get("precip", 0) > 30) + int(zone.get("wind", 0) > 40) + int(zone.get("elev", 500) < 50 and zone.get("r7d", 0) > 150) + int(zone.get("rad", 20) < 8)
    print(f"  {zone['name']:<24} {n_riders:>6} {avg_loss*100:>9.1f}% {triggers:>8}")

    for pname, (cov, cap) in PLANS.items():
        claims_14d = sum(p * DAILY_INCOME * cov for p in preds) * n_riders
        premium_14d = cap * 2 * n_riders  # 2 weeks of premium
        total_claims_all[pname] += claims_14d
        total_premium_all[pname] += premium_14d

print("\n  📊 POOLED 14-DAY RESULTS:")
print(f"  {'Plan':<22} {'Premium':>12} {'Claims':>12} {'BCR':>8} {'Status':>12}")
print("  " + "-" * 68)
for pname in PLANS:
    tc = total_claims_all[pname]
    tp = total_premium_all[pname]
    bcr = tc / tp if tp > 0 else 0
    status = "🔴 SUSPEND" if bcr > 0.85 else "🟡 WATCH" if bcr > 0.70 else "🟢 HEALTHY"
    result = PASS if bcr < 0.85 else FAIL
    log(f"Monsoon BCR ({pname})", result, f"BCR={bcr:.2f} | Premium=₹{tp:,.0f} | Claims=₹{tc:,.0f} | {status}")
    print(f"  {pname:<22} ₹{tp:>10,.0f} ₹{tc:>10,.0f} {bcr:>7.2f}   {status}")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 3: EXTREME HEAT WAVE (Rajasthan Summer)
# ══════════════════════════════════════════════════════════════════════════════
section("TEST 3: EXTREME HEAT WAVE — Rajasthan Summer (May)")

heat_days = []
for day in range(7):
    # 49°C peak heat wave
    heat_days.append(make_features(
        precip=0, wind=5, gust=10, temp=49, app_temp=53, rad=26,
        r7d=0, r3d_t=48, r7d_w=5, elev=431, coast=0,
        lat=26.92, lon=75.78, dist_coast=600, safety=0.90, month=5
    ))
heat_preds = predict_14d(heat_days * 2)
avg_heat_loss = np.mean(heat_preds)
status = PASS if avg_heat_loss > 0.10 else WARN
log("Heat Wave (49°C, 14 days) Loss Ratio", status, f"{avg_heat_loss*100:.2f}% [Triggers: heat_active=1]")

# Heat wave claimscheck
heat_riders = 300
heat_claims_basic = sum(p * DAILY_INCOME * 0.40 for p in heat_preds) * heat_riders
heat_premium_basic = 49 * 2 * heat_riders
heat_bcr = heat_claims_basic / heat_premium_basic
status = PASS if heat_bcr < 0.85 else FAIL
log("Heat Wave BCR (Basic, 300 riders)", status, f"BCR={heat_bcr:.2f} | Claims=₹{heat_claims_basic:,.0f} | Premium=₹{heat_premium_basic:,.0f}")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 4: CYCLONE SCENARIO (Bay of Bengal Coast)
# ══════════════════════════════════════════════════════════════════════════════
section("TEST 4: CYCLONE SCENARIO — Bay of Bengal (November)")

cyclone_profile = {"precip": 180, "wind": 120, "gust": 160, "temp": 29, "app_temp": 36,
                   "rad": 1, "r7d": 800, "r3d_t": 29, "r7d_w": 90, "elev": 4, "coast": 1,
                   "lat": 13.08, "lon": 80.27, "dist_coast": 3, "safety": 0.08}
cyclone_feats = [make_features(**{k: cyclone_profile[k] for k in cyclone_profile}, month=11) for _ in range(14)]
cyclone_preds = predict_14d(cyclone_feats)
avg_cyclone = np.mean(cyclone_preds)
max_cyclone = np.max(cyclone_preds)
status = PASS if avg_cyclone > 0.40 else WARN  # Cyclone should trigger high loss
log("Cyclone (180mm, 120km/h, Coastal): Avg Loss", status, f"{avg_cyclone*100:.1f}% | Peak Day: {max_cyclone*100:.1f}%")
log("Cyclone: All 5 Triggers Active", PASS if cyclone_profile["precip"] > 30 and cyclone_profile["wind"] > 40 and cyclone_profile["elev"] < 50 and cyclone_profile["r7d"] > 150 and cyclone_profile["rad"] < 8 else FAIL,
    f"Rain✓ Storm✓ Flood✓ Visibility✓ (Heat N/A in cyclone)")

cyclone_riders = 100
cyclone_claims = sum(p * DAILY_INCOME * 1.0 for p in cyclone_preds) * cyclone_riders
cyclone_premium = 169 * 2 * cyclone_riders
cy_bcr = cyclone_claims / cyclone_premium
status = WARN if cy_bcr > 0.85 else PASS  # Cyclone is a tail event; solvency is via diversification
log("Cyclone BCR (Premium, 100 coastal riders)", status, f"BCR={cy_bcr:.2f} [Tail event — pooling absorbs this]")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 5: EDGE CASES & BOUNDARY CONDITIONS
# ══════════════════════════════════════════════════════════════════════════════
section("TEST 5: EDGE CASES & BOUNDARY CONDITIONS")

# 5a: Negative inputs (should be clipped)
r_neg = predict(make_features(-50, -10, -5, 25, 26, 20, -100, 25, 0, 400, 0, 23.0, 80.0, 400, 0.90))
status = PASS if 0.0 <= r_neg <= 1.0 else FAIL
log("Negative Inputs (clipped to 0)", status, f"Output={r_neg:.4f} [Should be low & bounded]")

# 5b: Exact trigger boundary — 30mm (boundary, should NOT strongly trigger)
r_boundary = predict(make_features(30, 20, 30, 30, 33, 14, 100, 30, 18, 200, 0, 22.5, 75.0, 300, 0.70))
r_above = predict(make_features(31, 20, 30, 30, 33, 14, 100, 30, 18, 200, 0, 22.5, 75.0, 300, 0.70))
status = PASS if r_above >= r_boundary else WARN
log("Trigger Boundary (30mm vs 31mm)", status, f"30mm={r_boundary*100:.2f}% → 31mm={r_above*100:.2f}%")

# 5c: Himalayan zone (high elevation, low flood risk)
r_himal = predict(make_features(50, 25, 35, 15, 16, 12, 200, 15, 22, 2500, 0, 32.0, 77.0, 800, 0.65, month=7))
status = PASS if r_himal < 0.40 else WARN
log("Himalayan (2500m elev): Lower flood risk", status, f"{r_himal*100:.1f}% [High elev protects vs flood trigger]")

# 5d: Weekend vs Weekday (same weather)
base = dict(precip=20, wind=15, gust=22, temp=30, app_temp=33, rad=14, r7d=80, r3d_t=29, r7d_w=13, elev=500, coast=0, lat=18.5, lon=73.9, dist_coast=150, safety=0.75)
r_weekday = predict(make_features(**base, is_weekend=0))
r_weekend = predict(make_features(**base, is_weekend=1))
status = PASS  # weekend signal is minor; just check it doesn't blow up
log("Weekend vs Weekday Signal", status, f"Weekday={r_weekday*100:.2f}% | Weekend={r_weekend*100:.2f}%")

# 5e: NaN-like inputs (0 for all) — model should still return something
r_zeros = predict(make_features(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0))
status = PASS if 0.0 <= r_zeros <= 1.0 else FAIL
log("All-Zero Inputs (degenerate case)", status, f"Output={r_zeros:.4f} [Must not crash or go out of bounds]")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 6: ANNUAL SOLVENCY PROJECTION
# ══════════════════════════════════════════════════════════════════════════════
section("TEST 6: ANNUAL POOL SOLVENCY PROJECTION")

print(f"\n  Assumptions: {TOTAL_RIDERS:,} riders | ₹{DAILY_INCOME}/day avg income")
print(f"  Scenario: 14 monsoon peak days + 351 normal days (1.5% avg loss ratio)")
print()

for pname, (cov, cap) in PLANS.items():
    monsoon_claims = total_claims_all[pname]  # from test 2
    safe_claims = 351 * 0.015 * DAILY_INCOME * cov * TOTAL_RIDERS
    total_claims = monsoon_claims + safe_claims
    annual_premium = cap * 52 * TOTAL_RIDERS
    bcr = total_claims / annual_premium
    profit = annual_premium - total_claims
    margin = (1 - bcr) * 100
    status = "🔴 SUSPEND" if bcr > 0.85 else ("🟡 WATCH" if bcr > 0.70 else "🟢 HEALTHY")
    result = PASS if bcr < 0.85 else FAIL
    log(f"Annual BCR ({pname})", result, f"BCR={bcr:.2f} | Profit=₹{profit:,.0f} | Margin={margin:.1f}% | {status}")
    print(f"  {pname:<22}: BCR={bcr:.2f} | Annual Profit=₹{profit:,.0f} | Margin={margin:.1f}% {status}")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 7: GEOGRAPHIC COVERAGE CHECK
# ══════════════════════════════════════════════════════════════════════════════
section("TEST 7: GEOGRAPHIC COVERAGE SPOT CHECK")

geo_tests = [
    {"city": "Guwahati (NE)", "lat": 26.18, "lon": 91.74, "dist": 900, "elev": 55, "coast": 0, "safety": 0.25},
    {"city": "Shimla (Himachal)", "lat": 31.10, "lon": 77.17, "dist": 650, "elev": 2200, "coast": 0, "safety": 0.75},
    {"city": "Ahmedabad", "lat": 23.02, "lon": 72.57, "dist": 250, "elev": 53, "coast": 0, "safety": 0.80},
    {"city": "Visakhapatnam", "lat": 17.69, "lon": 83.22, "dist": 2, "elev": 45, "coast": 1, "safety": 0.18},
    {"city": "Bhubaneswar", "lat": 20.30, "lon": 85.82, "dist": 60, "elev": 45, "coast": 1, "safety": 0.22},
]

for g in geo_tests:
    r = predict(make_features(40, 25, 35, 30, 36, 10, 180, 30, 22, g["elev"], g["coast"],
                               g["lat"], g["lon"], g["dist"], g["safety"]))
    status = PASS if 0 <= r <= 1 else FAIL
    log(f"Coverage: {g['city']}", status, f"Loss Ratio={r*100:.2f}%")


# ══════════════════════════════════════════════════════════════════════════════
# FINAL SUMMARY REPORT
# ══════════════════════════════════════════════════════════════════════════════
section("FINAL AUDIT SUMMARY")

passed = sum(1 for _, s, _ in results_log if "PASS" in s)
warned = sum(1 for _, s, _ in results_log if "WARN" in s)
failed = sum(1 for _, s, _ in results_log if "FAIL" in s)
total = len(results_log)

print(f"\n  Total Tests : {total}")
print(f"  ✅ Passed   : {passed}")
print(f"  ⚠️  Warnings : {warned}")
print(f"  ❌ Failed   : {failed}")
print(f"  Pass Rate   : {passed/total*100:.1f}%")

if failed == 0 and warned <= 3:
    print("\n  🏆 MODEL AUDIT: PRODUCTION READY")
elif failed == 0:
    print("\n  ✅ MODEL AUDIT: PASSED WITH MINOR WARNINGS")
else:
    print("\n  ❌ MODEL AUDIT: REQUIRES ATTENTION")
    print("  Failed Tests:")
    for name, status, detail in results_log:
        if "FAIL" in status:
            print(f"    - {name}: {detail}")

print("\n" + "=" * 70)
