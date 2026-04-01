"""
╔══════════════════════════════════════════════════════════════════════════╗
║   GigShield v2 — FastAPI Inference Server                              ║
║   Dynamic Weekly Pricing | 5 Automated Triggers | GPS-Portable         ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║   Dynamic Pricing Engine:                                              ║
║     base_premium = ML_predicted_loss × coverage × actuarial_loading    ║
║                                                                        ║
║   Micro-Adjustments:                                                   ║
║     ✅ Zone Safety Discount    — ₹2-10/week off for safe GPS zones     ║
║     ✅ Forecast Surge          — auto-extend coverage hours            ║
║     ✅ No-Claim Streak         — loyalty discount for safe weeks       ║
║     ✅ Multi-Trigger Loading   — compound risk surcharge               ║
║     ✅ Seasonal Adjustment     — monsoon/winter risk premiums          ║
║                                                                        ║
║   POST /premium   — predict & price insurance from GPS + income        ║
║   POST /triggers  — evaluate real-time disruption triggers             ║
║   GET  /health    — model metadata & status                            ║
║   GET  /docs      — Swagger UI                                         ║
╚══════════════════════════════════════════════════════════════════════════╝

Run:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import asyncio
import json
import math
from datetime import date, timedelta
from typing import Optional, List

import httpx
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from disruption_triggers import (
    evaluate_all_triggers,
    compute_zone_safety_score,
    TriggerResult,
)

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────

MODEL_PATH = "gigshield_v2_model.joblib"
META_PATH  = "gigshield_v2_meta.json"

# Fallback to original model if v2 not yet trained
FALLBACK_MODEL = "../Premium_Model/gigguard_model.joblib"
FALLBACK_META  = "../Premium_Model/gigguard_model_meta.json"

DAYS_PER_WEEK = 7

# Three-tier plan config
PLANS = {
    "basic": {
        "label": "Basic",
        "coverage_pct": 0.40,
        "base_coverage_hours": 10,
        "loading_factor": 1.30,
        "description": "Covers 40% of daily income on disruption days.",
    },
    "standard": {
        "label": "Standard",
        "coverage_pct": 0.70,
        "base_coverage_hours": 14,
        "loading_factor": 1.45,
        "description": "Covers 70% of daily income. Auto-extended coverage on severe days.",
    },
    "premium": {
        "label": "Premium",
        "coverage_pct": 1.00,
        "base_coverage_hours": 18,
        "loading_factor": 1.60,
        "description": "Full income replacement. 24/7 coverage on extreme weather days.",
    },
}

# Indian coastline reference points
INDIA_COAST_REFS = [
    (8.0883, 77.5385), (9.9312, 76.2673), (11.0168, 76.9558),
    (13.0827, 80.2707), (15.3004, 73.9154), (17.6868, 83.2185),
    (19.0760, 72.8777), (20.2961, 85.8245), (21.1702, 72.8311),
    (22.5726, 88.3639), (23.2156, 69.6669),
]

# Fixed radiation denominator (must match training)
MAX_RADIATION = 25.0

# Minimum premium floors (INR)
MIN_WEEKLY = {"basic": 15.0, "standard": 25.0, "premium": 39.0}


# ─────────────────────────────────────────────────────────────────────────────
# APP INIT
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="GigShield v2 Insurance API",
    description="GPS-based parametric weather disruption insurance with dynamic pricing & automated triggers.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model
import os
try:
    if os.path.exists(MODEL_PATH):
        MODEL = joblib.load(MODEL_PATH)
        with open(META_PATH) as f:
            MODEL_META = json.load(f)
        FEATURE_COLS = MODEL_META["feature_cols"]
        print(f"✅ GigShield v2 model loaded — {len(FEATURE_COLS)} features | Test R² {MODEL_META['test_r2']}")
    elif os.path.exists(FALLBACK_MODEL):
        MODEL = joblib.load(FALLBACK_MODEL)
        with open(FALLBACK_META) as f:
            MODEL_META = json.load(f)
        FEATURE_COLS = MODEL_META["feature_cols"]
        print(f"⚠️  Using fallback model — {len(FEATURE_COLS)} features | R² {MODEL_META['test_r2']}")
        print(f"   Run build_and_train.py to create the v2 model.")
    else:
        raise FileNotFoundError("No model files found")
except Exception as e:
    raise RuntimeError(f"Model loading failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# GEO HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def distance_to_coast_km(lat, lon):
    return round(min(haversine_km(lat, lon, c[0], c[1]) for c in INDIA_COAST_REFS), 2)


# ─────────────────────────────────────────────────────────────────────────────
# WEATHER + ELEVATION FETCH
# ─────────────────────────────────────────────────────────────────────────────

DAILY_VARS = [
    "temperature_2m_max", "apparent_temperature_max",
    "precipitation_sum", "precipitation_hours",
    "wind_speed_10m_max", "wind_gusts_10m_max",
    "shortwave_radiation_sum",
]

async def fetch_weather_and_elevation(lat: float, lon: float, target_date: date = None):
    """Fetch 7-day archive (warmup) + 7-day forecast + elevation concurrently."""
    start = target_date or date.today()
    warmup_start = start - timedelta(days=7)

    async with httpx.AsyncClient(timeout=15) as client:
        archive_resp, forecast_resp, elev_resp = await asyncio.gather(
            client.get(
                "https://archive-api.open-meteo.com/v1/archive",
                params={
                    "latitude": lat, "longitude": lon,
                    "start_date": warmup_start.isoformat(),
                    "end_date": (start - timedelta(days=1)).isoformat(),
                    "daily": DAILY_VARS,
                    "timezone": "Asia/Kolkata",
                },
            ),
            client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat, "longitude": lon,
                    "daily": DAILY_VARS,
                    "forecast_days": 7,
                    "timezone": "Asia/Kolkata",
                },
            ),
            client.get(
                "https://api.open-meteo.com/v1/elevation",
                params={"latitude": lat, "longitude": lon},
            ),
        )

    if archive_resp.status_code != 200:
        raise HTTPException(502, f"Archive API error: {archive_resp.text[:200]}")
    if forecast_resp.status_code != 200:
        raise HTTPException(502, f"Forecast API error: {forecast_resp.text[:200]}")

    elevation = 100.0
    if elev_resp.status_code == 200:
        elevs = elev_resp.json().get("elevation", [100.0])
        elevation = float(elevs[0]) if elevs else 100.0

    archive_daily = archive_resp.json().get("daily", {})
    forecast_daily = forecast_resp.json().get("daily", {})

    required = ["time"] + DAILY_VARS
    for key in required:
        if key not in archive_daily:
            raise HTTPException(502, f"Missing from archive: {key}")
        if key not in forecast_daily:
            raise HTTPException(502, f"Missing from forecast: {key}")

    merged = {key: list(archive_daily[key]) + list(forecast_daily[key]) for key in required}
    return merged, elevation


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE ENGINEERING (mirrors training exactly)
# ─────────────────────────────────────────────────────────────────────────────

def build_inference_features(
    weather: dict, lat: float, lon: float,
    elevation: float, dist_coast: float, coastal: int,
    zone_safety: float,
) -> pd.DataFrame:
    """Build feature matrix for 7 forecast days (with 7-day warmup)."""

    df = pd.DataFrame({
        "date": pd.to_datetime(weather["time"]),
        "temperature_2m_max": weather["temperature_2m_max"],
        "apparent_temperature_max": weather["apparent_temperature_max"],
        "precipitation_sum": weather["precipitation_sum"],
        "precipitation_hours": weather["precipitation_hours"],
        "wind_speed_10m_max": weather["wind_speed_10m_max"],
        "wind_gusts_10m_max": weather["wind_gusts_10m_max"],
        "shortwave_radiation_sum": weather["shortwave_radiation_sum"],
    }).fillna(0)

    df["precipitation_sum"] = df["precipitation_sum"].clip(0, 200)

    # Rolling features (computed on all 14 rows)
    df["rolling_7d_rain"] = df["precipitation_sum"].rolling(7, min_periods=1).sum()
    df["rolling_3d_temp"] = df["temperature_2m_max"].rolling(3, min_periods=1).mean()

    # Time features
    doy = df["date"].dt.dayofyear
    df["sin_time"] = np.sin(2 * np.pi * doy / 365.25)
    df["cos_time"] = np.cos(2 * np.pi * doy / 365.25)
    df["is_weekend"] = df["date"].dt.dayofweek.isin([5, 6]).astype(int)

    # Interaction features
    df["rain_wind_interaction"] = df["precipitation_sum"] * df["wind_speed_10m_max"]
    df["rain_squared"] = df["precipitation_sum"] ** 2
    df["wind_squared"] = df["wind_speed_10m_max"] ** 2
    df["temp_squared"] = df["temperature_2m_max"] ** 2
    df["rain_wind_ratio"] = df["precipitation_sum"] / (df["wind_speed_10m_max"] + 1)

    # heat_index_proxy — FIXED denominator matching training
    humidity_proxy = (1 - (df["shortwave_radiation_sum"] / MAX_RADIATION)).clip(0, 1)
    df["heat_index_proxy"] = df["temperature_2m_max"] * humidity_proxy

    # Evaluate triggers for each day
    for i, row in df.iterrows():
        result = evaluate_all_triggers(
            precipitation_mm=row["precipitation_sum"],
            temp_max=row["temperature_2m_max"],
            apparent_temp_max=row["apparent_temperature_max"],
            wind_speed_max=row["wind_speed_10m_max"],
            wind_gust_max=row["wind_gusts_10m_max"],
            shortwave_radiation_mj=row["shortwave_radiation_sum"],
            rolling_7d_rain_mm=row.get("rolling_7d_rain", 0),
            rolling_3d_temp=row.get("rolling_3d_temp", 30),
            elevation_m=elevation,
            distance_to_coast_km=dist_coast,
            is_coastal=bool(coastal),
        )
        df.loc[i, "trigger_rain_active"] = int(result["triggers"][0].active)
        df.loc[i, "trigger_heat_active"] = int(result["triggers"][1].active)
        df.loc[i, "trigger_storm_active"] = int(result["triggers"][2].active)
        df.loc[i, "trigger_flood_active"] = int(result["triggers"][3].active)
        df.loc[i, "trigger_visibility_active"] = int(result["triggers"][4].active)
        df.loc[i, "n_triggers_active"] = result["n_active"]

    # Geo features
    df["elevation"] = elevation
    df["is_coastal"] = coastal
    df["latitude"] = lat
    df["longitude"] = lon
    df["distance_to_coast"] = dist_coast
    df["zone_safety_score"] = zone_safety

    # Tail event (keep for backward compat with fallback model)
    df["tail_event"] = (
        (df["precipitation_sum"] > 100) |
        (df["temperature_2m_max"] > 45) |
        (df["wind_speed_10m_max"] > 60)
    ).astype(int)

    # Return last 7 rows (forecast period)
    forecast_df = df.iloc[7:]
    available = [c for c in FEATURE_COLS if c in forecast_df.columns]
    return forecast_df[available].fillna(0).reset_index(drop=True), forecast_df


# ─────────────────────────────────────────────────────────────────────────────
# DYNAMIC PRICING ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def compute_dynamic_premium(
    avg_loss_ratio: float,
    daily_income: float,
    zone_safety: dict,
    forecast_triggers: list,
    target_date: date,
    no_claim_weeks: int = 0,
) -> dict:
    """
    Dynamic weekly pricing with micro-adjustments.
    
    Adjustments:
    1. Zone Safety Discount: safe-from-waterlogging areas get ₹2-10 off
    2. Forecast Surge: severe forecast → auto-extend coverage hours
    3. No-Claim Streak: consecutive safe weeks → loyalty discount
    4. Multi-Trigger Loading: multiple simultaneous triggers → surcharge
    5. Seasonal Adjustment: monsoon/winter adjustments
    """
    # Minimum loss ratio floor (actuarial base for tail risk)
    MIN_LOSS_RATIO = 0.02
    effective_ratio = max(avg_loss_ratio, MIN_LOSS_RATIO)

    # Count forecasted trigger days
    n_trigger_days = sum(1 for day_triggers in forecast_triggers if any(
        t.active for t in day_triggers
    ))
    max_trigger_count = max(
        (sum(1 for t in day_triggers if t.active) for day_triggers in forecast_triggers),
        default=0,
    )

    # Seasonal adjustment
    month = target_date.month
    seasonal_factor = 1.0
    seasonal_reason = None
    if month in [6, 7, 8, 9]:
        seasonal_factor = 1.15
        seasonal_reason = "Monsoon season (+15% risk loading)"
    elif month in [11, 12, 1]:
        seasonal_factor = 1.05
        seasonal_reason = "Winter fog/cold season (+5% risk loading)"

    plans_result = {}
    for key, plan in PLANS.items():
        # ── Base premium ──
        expected_payout = effective_ratio * daily_income * plan["coverage_pct"] * DAYS_PER_WEEK
        base_premium = round(expected_payout * plan["loading_factor"], 2)

        adjustments = []
        total_adj = 0.0

        # ── 1. Zone Safety Discount ──
        zone_discount = zone_safety.get("weekly_discount_inr", 0)
        if zone_discount > 0:
            adjusted_discount = round(zone_discount * plan["coverage_pct"], 2)
            adjustments.append({
                "type": "zone_safety_discount",
                "amount": -adjusted_discount,
                "reason": f"Historically safe zone (score: {zone_safety['zone_safety_score']:.2f})",
            })
            total_adj -= adjusted_discount

        # ── 2. Forecast Surge (auto-extend coverage hours) ──
        coverage_hours = plan["base_coverage_hours"]
        if n_trigger_days >= 4:
            surge = round(base_premium * 0.12, 2)
            adjustments.append({
                "type": "forecast_surge",
                "amount": surge,
                "reason": f"{n_trigger_days}/7 severe weather days forecasted — coverage extended",
            })
            total_adj += surge
            coverage_hours = min(24, coverage_hours + 6)
        elif n_trigger_days >= 2:
            surge = round(base_premium * 0.06, 2)
            adjustments.append({
                "type": "forecast_surge",
                "amount": surge,
                "reason": f"{n_trigger_days}/7 weather disruptions forecasted — coverage extended",
            })
            total_adj += surge
            coverage_hours = min(24, coverage_hours + 3)

        # ── 3. No-Claim Streak Discount ──
        if no_claim_weeks > 0:
            streak_pct = min(no_claim_weeks * 0.02, 0.15)  # max 15%
            streak_discount = round(base_premium * streak_pct, 2)
            adjustments.append({
                "type": "loyalty_discount",
                "amount": -streak_discount,
                "reason": f"{no_claim_weeks} consecutive safe weeks — {streak_pct*100:.0f}% loyalty reward",
            })
            total_adj -= streak_discount

        # ── 4. Multi-Trigger Loading ──
        if max_trigger_count >= 3:
            compound = round(base_premium * 0.15, 2)
            adjustments.append({
                "type": "compound_risk",
                "amount": compound,
                "reason": f"{max_trigger_count} simultaneous hazards detected — compound surcharge",
            })
            total_adj += compound
        elif max_trigger_count == 2:
            compound = round(base_premium * 0.08, 2)
            adjustments.append({
                "type": "compound_risk",
                "amount": compound,
                "reason": "2 simultaneous hazards — moderate compound loading",
            })
            total_adj += compound

        # ── 5. Seasonal Adjustment ──
        if seasonal_factor != 1.0 and seasonal_reason:
            seasonal_adj = round(base_premium * (seasonal_factor - 1.0), 2)
            adjustments.append({
                "type": "seasonal",
                "amount": seasonal_adj,
                "reason": seasonal_reason,
            })
            total_adj += seasonal_adj

        # Final premium
        final_premium = max(base_premium + total_adj, MIN_WEEKLY.get(key, 15.0))
        monthly_premium = round(final_premium * 4.33, 2)
        max_weekly_payout = round(daily_income * plan["coverage_pct"] * DAYS_PER_WEEK, 2)

        plans_result[key] = {
            "label": plan["label"],
            "coverage_pct": int(plan["coverage_pct"] * 100),
            "description": plan["description"],
            "coverage_hours_per_day": coverage_hours,
            "base_premium_inr": round(base_premium, 2),
            "adjustments": adjustments,
            "total_adjustment_inr": round(total_adj, 2),
            "weekly_premium_inr": round(final_premium, 2),
            "monthly_premium_inr": monthly_premium,
            "expected_weekly_payout_inr": round(expected_payout, 2),
            "max_weekly_payout_inr": max_weekly_payout,
        }

    return plans_result


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE MODELS
# ─────────────────────────────────────────────────────────────────────────────

class PremiumRequest(BaseModel):
    latitude: float = Field(..., ge=6.0, le=37.0)
    longitude: float = Field(..., ge=68.0, le=97.0)
    daily_income: float = Field(800.0, ge=100, le=10000)
    target_date: Optional[str] = None
    no_claim_weeks: int = Field(0, ge=0, le=52)


class TriggerInfo(BaseModel):
    trigger_id: str
    trigger_name: str
    icon: str
    active: bool
    severity: float
    loss_multiplier: float
    description: str


class AdjustmentInfo(BaseModel):
    type: str
    amount: float
    reason: str


class PlanDetail(BaseModel):
    label: str
    coverage_pct: int
    description: str
    coverage_hours_per_day: int
    base_premium_inr: float
    adjustments: List[AdjustmentInfo]
    total_adjustment_inr: float
    weekly_premium_inr: float
    monthly_premium_inr: float
    expected_weekly_payout_inr: float
    max_weekly_payout_inr: float


class ZoneProfile(BaseModel):
    elevation_m: float
    distance_to_coast_km: float
    is_coastal: bool
    waterlogging_risk: str
    zone_safety_score: float
    weekly_discount_inr: float


class ForecastRisk(BaseModel):
    trigger_days_count: int
    max_simultaneous_triggers: int
    coverage_extended: bool
    forecast_summary: str


class PremiumResponse(BaseModel):
    latitude: float
    longitude: float
    daily_income_inr: float
    date: str
    zone_profile: ZoneProfile
    active_triggers_today: List[TriggerInfo]
    forecast_risk: ForecastRisk
    forecast_loss_ratio_7d: float
    disruption_risk: str
    plans: dict
    model_version: str
    model_r2: float


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def risk_label(loss_ratio: float) -> str:
    if loss_ratio < 0.05: return "low"
    if loss_ratio < 0.15: return "moderate"
    if loss_ratio < 0.35: return "high"
    return "extreme"


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": MODEL_META.get("version", "v1_fallback"),
        "model_features": len(FEATURE_COLS),
        "test_r2": MODEL_META.get("test_r2"),
        "test_mae": MODEL_META.get("test_mae"),
        "triggers": MODEL_META.get("triggers", []),
        "note": MODEL_META.get("note", ""),
    }


@app.post("/premium", response_model=PremiumResponse)
async def predict_premium(req: PremiumRequest):
    lat, lon, income = req.latitude, req.longitude, req.daily_income

    try:
        target_date = date.fromisoformat(req.target_date) if req.target_date else date.today()
    except ValueError:
        raise HTTPException(400, "Invalid target_date. Use YYYY-MM-DD.")

    # ── Fetch weather + elevation ──
    weather, elevation = await fetch_weather_and_elevation(lat, lon, target_date)

    # ── Geo context ──
    dist_coast = distance_to_coast_km(lat, lon)
    coastal = 1 if dist_coast < 80 else 0
    zone_safety = compute_zone_safety_score(elevation, dist_coast, bool(coastal))

    # ── Build feature matrix ──
    X_forecast, forecast_df = build_inference_features(
        weather, lat, lon, elevation, dist_coast, coastal,
        zone_safety["zone_safety_score"],
    )

    # ── ML Prediction ──
    # Pad or trim columns to match model expectations
    for col in FEATURE_COLS:
        if col not in X_forecast.columns:
            X_forecast[col] = 0

    X_matrix = X_forecast[FEATURE_COLS].fillna(0).values
    if X_matrix.shape[1] < len(MODEL.feature_importances_):
        diff = len(MODEL.feature_importances_) - X_matrix.shape[1]
        X_matrix = np.hstack([X_matrix, np.zeros((X_matrix.shape[0], diff))])

    day_preds = MODEL.predict(X_matrix).clip(0)
    avg_loss_ratio = float(np.mean(day_preds))

    # ── Evaluate today's triggers ──
    today_weather = forecast_df.iloc[0] if len(forecast_df) > 0 else forecast_df.iloc[-1]
    today_result = evaluate_all_triggers(
        precipitation_mm=float(today_weather.get("precipitation_sum", 0)),
        temp_max=float(today_weather.get("temperature_2m_max", 30)),
        apparent_temp_max=float(today_weather.get("apparent_temperature_max", 32)),
        wind_speed_max=float(today_weather.get("wind_speed_10m_max", 10)),
        wind_gust_max=float(today_weather.get("wind_gusts_10m_max", 15)),
        shortwave_radiation_mj=float(today_weather.get("shortwave_radiation_sum", 15)),
        rolling_7d_rain_mm=float(today_weather.get("rolling_7d_rain", 0)),
        rolling_3d_temp=float(today_weather.get("rolling_3d_temp", 30)),
        elevation_m=elevation,
        distance_to_coast_km=dist_coast,
        is_coastal=bool(coastal),
    )

    # Forecast triggers for all 7 days
    forecast_triggers = []
    for _, row in forecast_df.iterrows():
        day_result = evaluate_all_triggers(
            precipitation_mm=float(row.get("precipitation_sum", 0)),
            temp_max=float(row.get("temperature_2m_max", 30)),
            apparent_temp_max=float(row.get("apparent_temperature_max", 32)),
            wind_speed_max=float(row.get("wind_speed_10m_max", 10)),
            wind_gust_max=float(row.get("wind_gusts_10m_max", 15)),
            shortwave_radiation_mj=float(row.get("shortwave_radiation_sum", 15)),
            rolling_7d_rain_mm=float(row.get("rolling_7d_rain", 0)),
            rolling_3d_temp=float(row.get("rolling_3d_temp", 30)),
            elevation_m=elevation,
            distance_to_coast_km=dist_coast,
            is_coastal=bool(coastal),
        )
        forecast_triggers.append(day_result["triggers"])

    n_trigger_days = sum(1 for day_t in forecast_triggers if any(t.active for t in day_t))
    max_sim = max((sum(1 for t in day_t if t.active) for day_t in forecast_triggers), default=0)

    # ── Dynamic Pricing ──
    plans = compute_dynamic_premium(
        avg_loss_ratio=avg_loss_ratio,
        daily_income=income,
        zone_safety=zone_safety,
        forecast_triggers=forecast_triggers,
        target_date=target_date,
        no_claim_weeks=req.no_claim_weeks,
    )

    # Forecast summary
    if n_trigger_days >= 4:
        forecast_summary = f"⚠️ Severe week: {n_trigger_days}/7 days with weather disruptions expected"
    elif n_trigger_days >= 2:
        forecast_summary = f"Moderate risk: {n_trigger_days}/7 days with disruptions forecasted"
    elif n_trigger_days == 1:
        forecast_summary = "Low risk: 1 disruption day expected this week"
    else:
        forecast_summary = "Clear week: no significant disruptions forecasted"

    coverage_extended = n_trigger_days >= 2

    return PremiumResponse(
        latitude=lat,
        longitude=lon,
        daily_income_inr=income,
        date=target_date.isoformat(),
        zone_profile=ZoneProfile(
            elevation_m=round(elevation, 1),
            distance_to_coast_km=dist_coast,
            is_coastal=bool(coastal),
            waterlogging_risk=zone_safety["waterlogging_risk"],
            zone_safety_score=zone_safety["zone_safety_score"],
            weekly_discount_inr=zone_safety["weekly_discount_inr"],
        ),
        active_triggers_today=[
            TriggerInfo(
                trigger_id=t.trigger_id,
                trigger_name=t.trigger_name,
                icon=t.icon,
                active=t.active,
                severity=t.severity,
                loss_multiplier=t.loss_multiplier,
                description=t.description,
            )
            for t in today_result["triggers"] if t.active
        ],
        forecast_risk=ForecastRisk(
            trigger_days_count=n_trigger_days,
            max_simultaneous_triggers=max_sim,
            coverage_extended=coverage_extended,
            forecast_summary=forecast_summary,
        ),
        forecast_loss_ratio_7d=round(max(avg_loss_ratio, 0.02), 4),
        disruption_risk=risk_label(avg_loss_ratio),
        plans=plans,
        model_version=MODEL_META.get("version", "v1_fallback"),
        model_r2=MODEL_META.get("test_r2", 0),
    )


@app.post("/triggers")
async def evaluate_triggers_now(req: PremiumRequest):
    """Quick trigger evaluation without full premium calculation."""
    lat, lon = req.latitude, req.longitude

    try:
        target_date = date.fromisoformat(req.target_date) if req.target_date else date.today()
    except ValueError:
        raise HTTPException(400, "Invalid date.")

    weather, elevation = await fetch_weather_and_elevation(lat, lon, target_date)
    dist_coast = distance_to_coast_km(lat, lon)
    coastal = dist_coast < 80

    # Today's weather (first forecast day = index 7)
    today_idx = min(7, len(weather["time"]) - 1)

    result = evaluate_all_triggers(
        precipitation_mm=float(weather["precipitation_sum"][today_idx] or 0),
        temp_max=float(weather["temperature_2m_max"][today_idx] or 30),
        apparent_temp_max=float(weather["apparent_temperature_max"][today_idx] or 32),
        wind_speed_max=float(weather["wind_speed_10m_max"][today_idx] or 10),
        wind_gust_max=float(weather["wind_gusts_10m_max"][today_idx] or 15),
        shortwave_radiation_mj=float(weather["shortwave_radiation_sum"][today_idx] or 15),
        rolling_7d_rain_mm=sum(
            float(x or 0) for x in weather["precipitation_sum"][max(0, today_idx-6):today_idx+1]
        ),
        rolling_3d_temp=np.mean([
            float(x or 30) for x in weather["temperature_2m_max"][max(0, today_idx-2):today_idx+1]
        ]),
        elevation_m=elevation,
        distance_to_coast_km=dist_coast,
        is_coastal=coastal,
    )

    return {
        "latitude": lat,
        "longitude": lon,
        "date": target_date.isoformat(),
        "elevation_m": elevation,
        "triggers": [
            {
                "id": t.trigger_id,
                "name": t.trigger_name,
                "icon": t.icon,
                "active": t.active,
                "severity": t.severity,
                "loss_multiplier": t.loss_multiplier,
                "description": t.description,
            }
            for t in result["triggers"]
        ],
        "any_active": result["any_active"],
        "compound_severity": result["compound_severity"],
        "composite_loss_ratio": result["composite_loss_ratio"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# RUN
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
