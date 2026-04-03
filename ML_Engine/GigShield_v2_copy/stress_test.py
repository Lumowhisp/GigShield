"""14-Day Monsoon Stress Test — POOLED MODEL (Realistic)"""
import numpy as np
import joblib, json

model = joblib.load("gigshield_v2_model.joblib")
meta = json.load(open("gigshield_v2_meta.json"))
FEATURES = meta["feature_cols"]

DAILY_INCOME = 1000
TOTAL_RIDERS = 1000

# Rider distribution across India (realistic)
ZONES = [
    {"name": "Mumbai (Monsoon Hit)", "pct": 0.10, "precip": 120, "wind": 55, "gust": 75, "temp": 31,
     "app_temp": 38, "rad": 5, "r7d": 600, "r3d_t": 30, "r7d_w": 45, "elev": 14, "coast": 1,
     "lat": 19.076, "lon": 72.877, "dist_coast": 2, "safety": 0.15},
    {"name": "Chennai (Moderate Rain)", "pct": 0.08, "precip": 40, "wind": 25, "gust": 35, "temp": 33,
     "app_temp": 40, "rad": 12, "r7d": 150, "r3d_t": 33, "r7d_w": 20, "elev": 6, "coast": 1,
     "lat": 13.08, "lon": 80.27, "dist_coast": 3, "safety": 0.20},
    {"name": "Delhi (Safe/Dry)", "pct": 0.20, "precip": 2, "wind": 8, "gust": 12, "temp": 38,
     "app_temp": 40, "rad": 22, "r7d": 10, "r3d_t": 37, "r7d_w": 8, "elev": 216, "coast": 0,
     "lat": 28.61, "lon": 77.20, "dist_coast": 1050, "safety": 0.85},
    {"name": "Bangalore (Clear)", "pct": 0.15, "precip": 5, "wind": 10, "gust": 15, "temp": 28,
     "app_temp": 30, "rad": 20, "r7d": 25, "r3d_t": 27, "r7d_w": 10, "elev": 920, "coast": 0,
     "lat": 12.97, "lon": 77.59, "dist_coast": 350, "safety": 0.92},
    {"name": "Jaipur (Dry)", "pct": 0.12, "precip": 0, "wind": 12, "gust": 18, "temp": 42,
     "app_temp": 43, "rad": 25, "r7d": 0, "r3d_t": 41, "r7d_w": 12, "elev": 431, "coast": 0,
     "lat": 26.92, "lon": 75.78, "dist_coast": 600, "safety": 0.90},
    {"name": "Kolkata (Heavy Rain)", "pct": 0.08, "precip": 80, "wind": 35, "gust": 50, "temp": 32,
     "app_temp": 39, "rad": 8, "r7d": 350, "r3d_t": 31, "r7d_w": 30, "elev": 9, "coast": 1,
     "lat": 22.57, "lon": 88.36, "dist_coast": 120, "safety": 0.18},
    {"name": "Hyderabad (Mild)", "pct": 0.12, "precip": 8, "wind": 12, "gust": 18, "temp": 34,
     "app_temp": 37, "rad": 18, "r7d": 40, "r3d_t": 33, "r7d_w": 11, "elev": 542, "coast": 0,
     "lat": 17.38, "lon": 78.48, "dist_coast": 500, "safety": 0.82},
    {"name": "Pune (Light Rain)", "pct": 0.10, "precip": 15, "wind": 15, "gust": 22, "temp": 29,
     "app_temp": 32, "rad": 15, "r7d": 80, "r3d_t": 28, "r7d_w": 14, "elev": 560, "coast": 0,
     "lat": 18.52, "lon": 73.85, "dist_coast": 150, "safety": 0.78},
    {"name": "Others (Mixed)", "pct": 0.05, "precip": 10, "wind": 10, "gust": 15, "temp": 30,
     "app_temp": 33, "rad": 16, "r7d": 50, "r3d_t": 29, "r7d_w": 10, "elev": 300, "coast": 0,
     "lat": 23.0, "lon": 80.0, "dist_coast": 400, "safety": 0.70},
]

def make_features(z):
    return {
        "precipitation_sum": z["precip"], "temperature_2m_max": z["temp"],
        "wind_speed_10m_max": z["wind"], "apparent_temperature_max": z["app_temp"],
        "precipitation_hours": max(z["precip"]/8, 1), "wind_gusts_10m_max": z["gust"],
        "shortwave_radiation_sum": z["rad"], "rolling_7d_rain": z["r7d"],
        "rolling_3d_temp": z["r3d_t"], "rolling_7d_wind": z["r7d_w"],
        "sin_time": 0.0, "cos_time": -1.0, "is_weekend": 0, "month": 7,
        "rain_wind_interaction": z["precip"]*z["wind"],
        "rain_squared": z["precip"]**2, "wind_squared": z["wind"]**2,
        "temp_squared": z["temp"]**2,
        "rain_wind_ratio": z["precip"]/(z["wind"]+1),
        "heat_index_proxy": z["app_temp"]-z["temp"],
        "rain_intensity": z["precip"]/(max(z["precip"]/8,1)+1),
        "temp_humidity_gap": z["app_temp"]-z["temp"],
        "trigger_rain_active": 1 if z["precip"]>30 else 0,
        "trigger_heat_active": 1 if z["temp"]>42 else 0,
        "trigger_storm_active": 1 if z["wind"]>40 else 0,
        "trigger_flood_active": 1 if z["elev"]<50 and z["r7d"]>150 else 0,
        "trigger_visibility_active": 1 if z["rad"]<8 else 0,
        "n_triggers_active": sum([z["precip"]>30, z["temp"]>42, z["wind"]>40,
                                   z["elev"]<50 and z["r7d"]>150, z["rad"]<8]),
        "elevation": z["elev"], "is_coastal": z["coast"],
        "latitude": z["lat"], "longitude": z["lon"],
        "distance_to_coast": z["dist_coast"], "zone_safety_score": z["safety"],
    }

plans = {"Basic(40%)": (0.40, 49), "Standard(70%)": (0.70, 99), "Premium(100%)": (1.00, 169)}

print("=" * 65)
print("🌧️  14-DAY MONSOON STRESS TEST — POOLED 1000 RIDERS")
print("=" * 65)

total_claims_all = {p: 0 for p in plans}
total_premium_all = {p: 0 for p in plans}

for zone in ZONES:
    n_riders = int(TOTAL_RIDERS * zone["pct"])
    feat = make_features(zone)
    X = np.array([[feat.get(f, 0) for f in FEATURES]] * 14)
    preds = np.clip(model.predict(X), 0, 1)
    avg_loss = np.mean(preds)

    print(f"\n📍 {zone['name']} ({n_riders} riders)")
    print(f"   Rain: {zone['precip']}mm | Wind: {zone['wind']}km/h | Loss: {avg_loss*100:.1f}%")

    for pname, (cov, cap) in plans.items():
        claims_14d = sum(p * DAILY_INCOME * cov for p in preds) * n_riders
        premium_14d = cap * 2 * n_riders
        total_claims_all[pname] += claims_14d
        total_premium_all[pname] += premium_14d

print("\n" + "=" * 65)
print("📊 POOLED RESULTS (14-day stress period)")
print("=" * 65)
for pname in plans:
    tc = total_claims_all[pname]
    tp = total_premium_all[pname]
    bcr = tc / tp if tp > 0 else 0
    status = "🔴 SUSPEND" if bcr > 0.85 else "🟡 WATCH" if bcr > 0.70 else "🟢 HEALTHY"
    print(f"\n📋 {pname}")
    print(f"   Total Premium:  ₹{tp:,.0f}")
    print(f"   Total Claims:   ₹{tc:,.0f}")
    print(f"   BCR:            {bcr:.2f}  {status}")
    print(f"   Net P&L:        ₹{tp-tc:,.0f}")

# ANNUAL with this monsoon baked in
print("\n" + "=" * 65)
print("📅 ANNUAL VIEW (14 monsoon + 351 normal days)")
print("=" * 65)
for pname, (cov, cap) in plans.items():
    monsoon_claims = total_claims_all[pname]
    # Safe period: avg 1.5% loss ratio across pool
    safe_claims = 351 * 0.015 * DAILY_INCOME * cov * TOTAL_RIDERS
    total_claims = monsoon_claims + safe_claims
    annual_premium = cap * 52 * TOTAL_RIDERS
    bcr = total_claims / annual_premium
    status = "🔴 SUSPEND" if bcr > 0.85 else "🟡 WATCH" if bcr > 0.70 else "🟢 HEALTHY"
    print(f"\n📋 {pname}")
    print(f"   Annual Premium:  ₹{annual_premium:,.0f}")
    print(f"   Annual Claims:   ₹{total_claims:,.0f}")
    print(f"   Annual BCR:      {bcr:.2f}  {status}")
    print(f"   Annual Profit:   ₹{annual_premium-total_claims:,.0f}")
    print(f"   Profit Margin:   {(1-bcr)*100:.1f}%")
