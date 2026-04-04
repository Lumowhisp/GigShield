"""
╔══════════════════════════════════════════════════════════════════════════════╗
║         GigGuard — Inference API  (FastAPI)                                ║
║         GPS-based parametric insurance premium for gig workers             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Flow:                                                                      ║
║    POST /premium  { lat, lon, daily_income }                               ║
║    → fetch elevation (Open-Meteo)                                           ║
║    → fetch past 7 days archive (rolling warmup) + next 7 days forecast     ║
║    → compute geo features (coastal distance, is_coastal)                   ║
║    → load XGBoost model → predict loss_ratio for each of next 7 days       ║
║    → sum weekly loss → return premium breakdown                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

Install:
    pip install fastapi uvicorn joblib xgboost pandas numpy httpx

Run:
    uvicorn main:app --reload --port 8000

Endpoints:
    POST /premium          — predict premium for a GPS location
    GET  /health           — health + model metadata
    GET  /docs             — Swagger UI
"""

import asyncio
import json
import math
from datetime import date, timedelta
from typing import Optional

import httpx
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─────────────────────────────────────────────────────────────────────────────
# ⚙️  CONFIG
# ─────────────────────────────────────────────────────────────────────────────

MODEL_PATH = "gigguard_model.joblib"
META_PATH  = "gigguard_model_meta.json"

# Actuarial loading factors (same as training pipeline)
RISK_LOADING    = 0.20   # 20% reserve for adverse deviation
EXPENSE_LOADING = 0.15   # 15% operational costs
PROFIT_MARGIN   = 0.10   # 10% margin

SAFETY_MARGIN   = 1 + RISK_LOADING + EXPENSE_LOADING + PROFIT_MARGIN  # = 1.45

DAYS_PER_WEEK   = 7

# ── Three-tier plan config ────────────────────────────────────────────────────
# Same disruption trigger for all tiers (0.45 threshold from training)
# Only payout coverage % differs — worker chooses how much income to protect
PLANS = {
    "basic": {
        "label":          "Basic",
        "coverage_pct":   0.40,   # 40% of daily income replaced on disruption
        "loading_factor": 1.30,   # lower margin — entry product
        "description":    "Covers 40% of daily income on disruption days.",
    },
    "standard": {
        "label":          "Standard",
        "coverage_pct":   0.70,   # 70% of daily income replaced
        "loading_factor": 1.45,   # standard actuarial margin
        "description":    "Covers 70% of daily income on disruption days. Recommended.",
    },
    "premium": {
        "label":          "Premium",
        "coverage_pct":   1.00,   # 100% of daily income replaced
        "loading_factor": 1.60,   # higher margin — full coverage
        "description":    "Full income replacement on disruption days.",
    },
}

# Indian coastline reference points for distance computation
INDIA_COAST_REFS = [
    (8.0883,  77.5385),   # Kanyakumari
    (9.9312,  76.2673),   # Kochi
    (11.0168, 76.9558),   # Kozhikode
    (13.0827, 80.2707),   # Chennai
    (15.3004, 73.9154),   # Panaji (Goa)
    (17.6868, 83.2185),   # Visakhapatnam
    (19.0760, 72.8777),   # Mumbai
    (20.2961, 85.8245),   # Bhubaneswar coast
    (21.1702, 72.8311),   # Surat
    (22.5726, 88.3639),   # Kolkata
    (23.2156, 69.6669),   # Kutch (Gujarat)
]

# ─────────────────────────────────────────────────────────────────────────────
# 🚀  APP INIT
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="GigGuard Insurance API",
    description="GPS-based parametric weather disruption insurance for gig workers in India.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model once at startup
try:
    MODEL = joblib.load(MODEL_PATH)
    with open(META_PATH) as f:
        MODEL_META = json.load(f)
    FEATURE_COLS = MODEL_META["feature_cols"]
    print(f"✅ Model loaded — {len(FEATURE_COLS)} features | Test R² {MODEL_META['test_r2']}")
except FileNotFoundError:
    raise RuntimeError(
        "Model files not found. Run generate_daily_risk_data.py first "
        "to produce gigguard_model.joblib and gigguard_model_meta.json"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 📐  GEO HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def distance_to_coast_km(lat: float, lon: float) -> float:
    return round(min(haversine_km(lat, lon, clat, clon) for clat, clon in INDIA_COAST_REFS), 2)


def is_coastal(distance_km: float) -> int:
    """Matches NDMA definition used in training — within ~80 km of coast."""
    return 1 if distance_km < 80 else 0


# ─────────────────────────────────────────────────────────────────────────────
# 🌤️  WEATHER + ELEVATION FETCH  (Open-Meteo, free, no API key)
# ─────────────────────────────────────────────────────────────────────────────

async def fetch_weather_forecast(lat: float, lon: float, target_date: date = None) -> dict:
    """
    Fetches weather for the 7-day coverage window starting from target_date,
    plus 7 days of archive history as rolling-window warmup.

    Two-step fetch:
      1. Archive API  — past 7 days (rolling_7d_rain / rolling_3d_temp warmup)
      2. Forecast API — next 7 days (the actual period being priced)

    Open-Meteo both APIs are free, no key needed.
    Combined = 14 rows; first 7 are warmup-only, last 7 are priced.
    """
    start_date   = target_date or date.today()
    warmup_start = start_date - timedelta(days=7)

    DAILY_VARS = [
        "temperature_2m_max",
        "apparent_temperature_max",
        "precipitation_sum",
        "precipitation_hours",
        "wind_speed_10m_max",
        "wind_gusts_10m_max",
        "shortwave_radiation_sum",
    ]

    async with httpx.AsyncClient(timeout=15) as client:
        # 1. Archive: past 7 days for rolling-window warmup
        archive_resp, forecast_resp = await asyncio.gather(
            client.get(
                "https://archive-api.open-meteo.com/v1/archive",
                params={
                    "latitude":   lat,
                    "longitude":  lon,
                    "start_date": warmup_start.isoformat(),
                    "end_date":   (start_date - timedelta(days=1)).isoformat(),
                    "daily":      DAILY_VARS,
                    "timezone":   "Asia/Kolkata",
                },
            ),
            # 2. Forecast: next 7 days — the actual period being priced
            client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude":      lat,
                    "longitude":     lon,
                    "daily":         DAILY_VARS,
                    "forecast_days": 7,
                    "timezone":      "Asia/Kolkata",
                },
            ),
        )

    if archive_resp.status_code != 200:
        raise HTTPException(502, f"Archive API error: {archive_resp.text[:200]}")
    if forecast_resp.status_code != 200:
        raise HTTPException(502, f"Forecast API error: {forecast_resp.text[:200]}")

    archive_daily  = archive_resp.json().get("daily", {})
    forecast_daily = forecast_resp.json().get("daily", {})

    required = ["time"] + DAILY_VARS
    for key in required:
        if key not in archive_daily:
            raise HTTPException(502, f"Missing field from archive API: {key}")
        if key not in forecast_daily:
            raise HTTPException(502, f"Missing field from forecast API: {key}")

    # Merge: 7 warmup rows + 7 forecast rows = 14 total
    return {key: list(archive_daily[key]) + list(forecast_daily[key]) for key in required}


async def fetch_elevation(lat: float, lon: float) -> float:
    """Open-Meteo elevation endpoint — returns metres above sea level."""
    url = "https://api.open-meteo.com/v1/elevation"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params={"latitude": lat, "longitude": lon})
        if resp.status_code != 200:
            return 100.0   # safe fallback — median Indian city elevation
        data = resp.json()
    elevations = data.get("elevation", [100.0])
    return float(elevations[0]) if elevations else 100.0


# ─────────────────────────────────────────────────────────────────────────────
# 🧠  FEATURE ENGINEERING  (mirrors training pipeline exactly)
# ─────────────────────────────────────────────────────────────────────────────

def build_inference_features(
    weather: dict,
    lat: float,
    lon: float,
    elevation: float,
    dist_coast: float,
    coastal: int,
    target_date: date,
) -> pd.DataFrame:
    """
    Reconstructs all 24 model features from raw weather + geo inputs.
    Must exactly mirror the feature engineering in generate_daily_risk_data.py.
    """
    df = pd.DataFrame({
        "date":                     pd.to_datetime(weather["time"]),
        "temperature_2m_max":       weather["temperature_2m_max"],
        "apparent_temperature_max": weather["apparent_temperature_max"],
        "precipitation_sum":        weather["precipitation_sum"],
        "precipitation_hours":      weather["precipitation_hours"],
        "wind_speed_10m_max":       weather["wind_speed_10m_max"],
        "wind_gusts_10m_max":       weather["wind_gusts_10m_max"],
        "shortwave_radiation_sum":  weather["shortwave_radiation_sum"],
    })

    df = df.fillna(0)
    df["precipitation_sum"] = df["precipitation_sum"].clip(0, 150)

    # ── Duration features (rolling) ──
    df["rolling_7d_rain"] = df["precipitation_sum"].rolling(window=7, min_periods=1).sum()
    df["rolling_3d_temp"] = df["temperature_2m_max"].rolling(window=3, min_periods=1).mean()

    # ── Time features ──
    day_of_year        = df["date"].dt.dayofyear
    df["sin_time"]     = np.sin(2 * np.pi * day_of_year / 365.25)
    df["cos_time"]     = np.cos(2 * np.pi * day_of_year / 365.25)
    df["is_weekend"]   = df["date"].dt.dayofweek.isin([5, 6]).astype(int)

    # ── Interaction features ──
    df["rain_wind_interaction"] = df["precipitation_sum"] * df["wind_speed_10m_max"]
    df["rain_squared"]          = df["precipitation_sum"] ** 2
    df["wind_squared"]          = df["wind_speed_10m_max"] ** 2
    df["temp_squared"]          = df["temperature_2m_max"] ** 2
    df["rain_wind_ratio"]       = df["precipitation_sum"] / (df["wind_speed_10m_max"] + 1)

    # humidity proxy — use median radiation as fallback baseline
    max_rad = df["shortwave_radiation_sum"].quantile(0.95) or 22
    df["heat_index_proxy"] = df["temperature_2m_max"] * (
        1 - (df["shortwave_radiation_sum"] / max_rad).clip(0, 1)
    )

    # ── Tail event flag ──
    df["tail_event"] = (
        (df["precipitation_sum"] > 100) |
        (df["temperature_2m_max"] > 45) |
        (df["wind_speed_10m_max"] > 60)
    ).astype(int)

    # ── Geo features (same for all rows — derived from GPS) ──
    df["elevation"]         = elevation
    df["is_coastal"]        = coastal
    df["latitude"]          = lat
    df["longitude"]         = lon
    df["distance_to_coast"] = dist_coast

    # Return last 7 rows (the forecast window being priced).
    # First 7 rows were archive warmup for rolling features only.
    return df.iloc[7:][FEATURE_COLS].fillna(0).reset_index(drop=True)


# ─────────────────────────────────────────────────────────────────────────────
# 📦  REQUEST / RESPONSE MODELS
# ─────────────────────────────────────────────────────────────────────────────

class PremiumRequest(BaseModel):
    latitude:     float = Field(..., ge=6.0,  le=37.0,  description="GPS latitude (India: 6–37°N)")
    longitude:    float = Field(..., ge=68.0, le=97.0,  description="GPS longitude (India: 68–97°E)")
    daily_income: float = Field(800.0, ge=100, le=10000, description="Worker's daily income in INR")
    target_date:  Optional[str] = Field(None, description="YYYY-MM-DD — defaults to today")


class PlanDetail(BaseModel):
    label:                      str
    coverage_pct:               int
    description:                str
    expected_weekly_payout_inr: float
    max_weekly_payout_inr:      float
    weekly_premium_inr:         float
    monthly_premium_inr:        float


class PremiumResponse(BaseModel):
    # Input echo
    latitude:             float
    longitude:            float
    daily_income_inr:     float
    date:                 str

    # Geo context
    elevation_m:          float
    distance_to_coast_km: float
    is_coastal:           bool

    # Risk signal
    forecast_loss_ratio_7d: float   # avg daily loss ratio over next 7 days
    forecast_loss_inr_7d:   float   # total expected loss over the week (INR)
    disruption_risk:        str     # low / moderate / high / extreme

    # Three-tier plans
    plans: dict[str, PlanDetail]

    model_r2:             float


# ─────────────────────────────────────────────────────────────────────────────
# 🔢  PREMIUM CALCULATION
# ─────────────────────────────────────────────────────────────────────────────

def risk_label(loss_ratio: float) -> str:
    if loss_ratio < 0.05:  return "low"
    if loss_ratio < 0.15:  return "moderate"
    if loss_ratio < 0.35:  return "high"
    return "extreme"


def compute_plan_premiums(avg_loss_ratio: float, daily_income: float) -> dict:
    """
    Computes weekly + monthly premium for all three tiers.
    expected_payout = avg_loss_ratio × daily_income × coverage_pct × 7
    weekly_premium  = expected_payout × loading_factor

    Actuarial note: even in zero-risk weeks, there's always a base premium
    covering the long-tail probability of unexpected catastrophic events.
    MIN_LOSS_RATIO ensures premiums never collapse to ₹0.
    """
    # Minimum 2% base loss ratio — covers tail risk even in clear weather
    MIN_LOSS_RATIO = 0.02
    effective_ratio = max(avg_loss_ratio, MIN_LOSS_RATIO)

    # Per-tier minimum weekly premiums (INR) — floor for the product
    MIN_WEEKLY_PREMIUM = {"basic": 15.0, "standard": 25.0, "premium": 39.0}

    results = {}
    for key, plan in PLANS.items():
        expected_weekly_payout = effective_ratio * daily_income * plan["coverage_pct"] * DAYS_PER_WEEK
        weekly_premium         = round(expected_weekly_payout * plan["loading_factor"], 2)
        # Enforce per-tier floor so UI never shows ₹0
        weekly_premium         = max(weekly_premium, MIN_WEEKLY_PREMIUM.get(key, 15.0))
        monthly_premium        = round(weekly_premium * 4.33, 2)
        max_weekly_payout      = round(daily_income * plan["coverage_pct"] * DAYS_PER_WEEK, 2)

        results[key] = {
            "label":                      plan["label"],
            "coverage_pct":               int(plan["coverage_pct"] * 100),
            "description":                plan["description"],
            "expected_weekly_payout_inr": round(expected_weekly_payout, 2),
            "max_weekly_payout_inr":      max_weekly_payout,
            "weekly_premium_inr":         weekly_premium,
            "monthly_premium_inr":        monthly_premium,
        }
    return results


# ─────────────────────────────────────────────────────────────────────────────
# 🛣️  ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status":         "ok",
        "model_features": len(FEATURE_COLS),
        "test_r2":        MODEL_META["test_r2"],
        "test_mae_inr":   MODEL_META["test_mae"],
        "note":           MODEL_META["note"],
    }


@app.post("/premium", response_model=PremiumResponse)
async def predict_premium(req: PremiumRequest):
    lat  = req.latitude
    lon  = req.longitude
    income = req.daily_income

    # Parse target date
    try:
        target_date = (
            date.fromisoformat(req.target_date) if req.target_date else date.today()
        )
    except ValueError:
        raise HTTPException(400, "Invalid target_date format. Use YYYY-MM-DD.")

    # ── Fetch external data ──
    weather, elevation = await asyncio.gather(
        fetch_weather_forecast(lat, lon, target_date),
        fetch_elevation(lat, lon),
    )

    # ── Compute geo features ──
    dist_coast = distance_to_coast_km(lat, lon)
    coastal    = is_coastal(dist_coast)

    # ── Build feature matrix (7 warmup + 7 forecast rows → returns 7 forecast rows) ──
    X_forecast = build_inference_features(
        weather, lat, lon, elevation, dist_coast, coastal, target_date
    )

    # ── Predict next 7 days ──
    day_preds = MODEL.predict(X_forecast).clip(0)   # shape: (7,)

    avg_loss_ratio_7d  = float(np.mean(day_preds))
    total_loss_inr_7d  = float(np.sum(day_preds) * income)   # sum across 7 days

    # ── Compute all three tier premiums ──
    plans = compute_plan_premiums(avg_loss_ratio_7d, income)

    return PremiumResponse(
        latitude=lat,
        longitude=lon,
        daily_income_inr=income,
        date=target_date.isoformat(),
        elevation_m=round(elevation, 1),
        distance_to_coast_km=dist_coast,
        is_coastal=bool(coastal),
        forecast_loss_ratio_7d=round(avg_loss_ratio_7d, 4),
        forecast_loss_inr_7d=round(total_loss_inr_7d, 2),
        disruption_risk=risk_label(avg_loss_ratio_7d),
        plans=plans,
        model_r2=MODEL_META["test_r2"],
    )



# ─────────────────────────────────────────────────────────────────────────────
# 🏃  RUN
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)