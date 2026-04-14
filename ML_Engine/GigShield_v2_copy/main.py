"""
╔══════════════════════════════════════════════════════════════════════════╗
║   GigShield v2 — FastAPI Inference Server                                ║
║   Dynamic Weekly Pricing | 5 Automated Triggers | GPS-Portable           ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║   Dynamic Pricing Engine:                                                ║
║     base_premium = ML_predicted_loss × coverage × actuarial_loading      ║
║                                                                          ║
║   Micro-Adjustments:                                                     ║
║     ✅ Zone Safety Discount    — ₹2-10/week off for safe GPS zones       ║
║     ✅ Forecast Surge          — auto-extend coverage hours              ║
║     ✅ No-Claim Streak         — loyalty discount for safe weeks         ║
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

import os
from dotenv import load_dotenv

load_dotenv()

import asyncio
import json
import math
import random
import string
from datetime import date, timedelta, datetime, timezone
from typing import Optional, List

import httpx
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── MongoDB & Auth Imports (Added for User Login) ──
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import re
import jwt
from datetime import datetime, timedelta, timezone

# ── Razorpay & Scheduler Imports ──
import razorpay
import hmac
import hashlib
from apscheduler.schedulers.asyncio import AsyncIOScheduler

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
MIN_WEEKLY = {"basic": 20.0, "standard": 20.0, "premium": 39.0}

# Maximum premium caps (INR) — actuarially derived for pooled model
# Basic & Standard capped for affordability; Premium uncapped for high-risk riders
MAX_WEEKLY = {"basic": 49.0, "standard": 99.0, "premium": None}


import math

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points on the earth (specified in decimal degrees). Returns distance in km."""
    # Convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])

    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371 # Radius of earth in kilometers.
    return c * r

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

# ─────────────────────────────────────────────────────────────────────────────
# DATABASE LIFECYCLE (MongoDB Integration)
# ─────────────────────────────────────────────────────────────────────────────

# Configurable MongoDB connect URI for the GigGuard app instance
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")

# JWT configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback_secret_key")
ALGORITHM = "HS256"

# Razorpay Sandbox Configuration
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    razorpay_client.set_app_details({"title": "GigGuard", "version": "2.0.0"})
    print(f"✅ Razorpay Sandbox client initialized (Key: {RAZORPAY_KEY_ID[:16]}...)")
else:
    print("⚠️  Razorpay keys not set — payment gateway disabled")
ACCESS_TOKEN_EXPIRE_DAYS = 7

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
from collections import deque

# ── APScheduler instance (created before startup) ──
scheduler = AsyncIOScheduler()

# ── GLOBAL VELOCITY CIRCUIT BREAKER ──
GLOBAL_PAYOUT_VELOCITY_TRACKER = deque()
MAX_PAYOUT_PER_5_MINS = 50000.0
GLOBAL_PAYOUT_FREEZE = False

async def evaluate_composite_fraud_score(client: httpx.AsyncClient, user: dict, lat: float, lon: float, actual_elevation: float) -> dict:
    """
    Unified Trust-Aware Fraud Scoring Engine (Level 7).
    Returns a FraudVerdict dict:
      - score (int): composite fraud points (0-200+)
      - api_failures (int): how many verification APIs failed
      - temporal_flag (bool): erratic ping timing detected
      - behavioral_flag (bool): suspicious claim-to-policy ratio
      - details (list[str]): human-readable audit trail
    """
    fraud_score = 0
    api_failures = 0
    temporal_flag = False
    behavioral_flag = False
    details = []
    
    # ── LAYER A: Topographical 3D Trap ──
    phone_altitude = user.get("last_altitude", 0.0)
    if abs(phone_altitude - actual_elevation) > 150.0 and actual_elevation > 200.0:
        fraud_score += 45
        details.append(f"Elevation mismatch: phone={phone_altitude:.0f}m vs terrain={actual_elevation:.0f}m")
        
    # ── LAYER B: Network IP Sentinel ──
    last_ip = user.get("last_ip")
    if last_ip and last_ip not in ["127.0.0.1", "localhost", "::1"]:
        try:
            ip_resp = await client.get(f"http://ip-api.com/json/{last_ip}?fields=hosting,proxy,countryCode")
            if ip_resp.status_code == 200:
                ip_data = ip_resp.json()
                if ip_data.get("hosting") is True or ip_data.get("proxy") is True:
                    fraud_score += 20
                    details.append(f"IP {last_ip}: Datacenter/Proxy detected")
                if ip_data.get("countryCode") != "IN":
                    fraud_score += 50
                    details.append(f"IP {last_ip}: Routed from {ip_data.get('countryCode', '?')} (non-India)")
            else:
                api_failures += 1
        except Exception:
            api_failures += 1
            
    # ── LAYER C: Kinematic Route Engine (OSRM) ──
    history = user.get("location_history", [])
    if len(history) >= 2:
        last_ping = history[-1]
        prev_ping = history[-2]
        
        time_delta_seconds = (last_ping["time"] - prev_ping["time"]).total_seconds()
        time_delta_hours = time_delta_seconds / 3600.0
        
        if time_delta_hours > 0 and time_delta_hours < 24.0:
            try:
                osrm_url = f"http://router.project-osrm.org/route/v1/driving/{prev_ping['lon']},{prev_ping['lat']};{last_ping['lon']},{last_ping['lat']}?overview=false"
                rout_resp = await client.get(osrm_url)
                if rout_resp.status_code == 200:
                    rout_data = rout_resp.json()
                    if rout_data.get("code") == "Ok":
                        road_distance_km = rout_data["routes"][0]["distance"] / 1000.0
                        street_speed = road_distance_km / time_delta_hours
                        if street_speed > 140.0:
                            fraud_score += 100
                            details.append(f"OSRM: Impossible speed {street_speed:.0f} km/h")
                        elif street_speed > 100.0:
                            fraud_score += 50
                            details.append(f"OSRM: Suspicious speed {street_speed:.0f} km/h")
                else:
                    api_failures += 1
            except Exception:
                api_failures += 1
                
    # ── LAYER D: Temporal Consistency Check ──
    if len(history) >= 3:
        intervals = []
        for i in range(1, len(history)):
            delta = (history[i]["time"] - history[i-1]["time"]).total_seconds()
            if delta > 0:
                intervals.append(delta)
        if len(intervals) >= 2:
            mean_interval = sum(intervals) / len(intervals)
            if mean_interval > 0:
                variance = sum((x - mean_interval) ** 2 for x in intervals) / len(intervals)
                std_dev = variance ** 0.5
                cv = std_dev / mean_interval  # Coefficient of Variation
                if cv > 2.0:
                    temporal_flag = True
                    fraud_score += 25
                    details.append(f"Temporal anomaly: ping CV={cv:.2f} (erratic bot-like pattern)")
                    
    # ── LAYER E: Behavioral Consistency Check ──
    payout_history = user.get("payout_history", [])
    policy_history = user.get("policy_history", [])
    policies_count = len(policy_history)
    payouts_count = len(payout_history)
    
    if policies_count >= 3:
        claim_ratio = payouts_count / policies_count
        if claim_ratio > 0.85:
            behavioral_flag = True
            fraud_score += 30
            details.append(f"Behavioral anomaly: {payouts_count}/{policies_count} policies claimed ({claim_ratio:.0%})")
            
    # ── LAYER F: API Fail-Safe (Fog of War Penalty) ──
    if api_failures >= 2:
        fraud_score += 15
        details.append(f"Fog of War: {api_failures} verification APIs unreachable — cautionary loading applied")
                
    return {
        "score": fraud_score,
        "api_failures": api_failures,
        "temporal_flag": temporal_flag,
        "behavioral_flag": behavioral_flag,
        "details": details,
    }


def get_trust_tier(trust_score: float) -> dict:
    """Returns the trust tier config based on user's persistent trust score."""
    if trust_score >= 80:
        return {"label": "VETERAN", "emoji": "🟢", "vesting_hours": 4, "check_level": "light"}
    elif trust_score >= 50:
        return {"label": "TRUSTED", "emoji": "🔵", "vesting_hours": 12, "check_level": "full"}
    elif trust_score >= 25:
        return {"label": "NEUTRAL", "emoji": "🟡", "vesting_hours": 24, "check_level": "full+flag"}
    else:
        return {"label": "SUSPICIOUS", "emoji": "🔴", "vesting_hours": 48, "check_level": "full+block"}

@app.on_event("startup")
async def startup_db_client():
    """Starts the MongoDB Client when the FastAPI App boots up."""
    app.mongodb_client = AsyncIOMotorClient(MONGODB_URL)
    app.mongodb = app.mongodb_client["gigguard_db"]
    # Quick health check to ensure credentials work
    try:
        await app.mongodb_client.admin.command('ping')
        print("✅ Pinged your deployment. Successfully connected to MongoDB!")
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")

    # ── Start Autopay Scheduler ──
    scheduler.add_job(autopay_trigger_scan, "interval", seconds=30, id="autopay_scan", replace_existing=True)
    scheduler.start()
    print("✅ Autopay scheduler started — scanning every 5 minutes")

@app.on_event("shutdown")
async def shutdown_db_client():
    """Disconnects MongoDB neatly when server shuts down."""
    scheduler.shutdown(wait=False)
    app.mongodb_client.close()

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


def generate_gig_id():
    """Generates a random Gig ID like GG-2024-X4Y8"""
    random_digits = ''.join(random.choices(string.digits, k=4))
    return f"GG-2024-{random_digits}"


async def fetch_weather_and_elevation(lat: float, lon: float, target_date: date) -> tuple[dict, float]:
    """
    Fetches the last 7 days of archive data + 7 days forecast in one go.
    Uses Open-Meteo's unified endpoints.
    Includes a safety fallback mode for hackathon demos if WiFi drops.
    """
    import httpx
    
    start_date = target_date - timedelta(days=7)
    end_date = target_date + timedelta(days=6)

    archive_url = f"https://archive-api.open-meteo.com/v1/archive"
    forecast_url = f"https://api.open-meteo.com/v1/forecast"
    elev_url = f"https://api.open-meteo.com/v1/elevation"

    common_params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "precipitation_sum,temperature_2m_max,apparent_temperature_max,wind_speed_10m_max,wind_gusts_10m_max,shortwave_radiation_sum,precipitation_hours",
        "timezone": "IST",
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            archive_resp, forecast_resp, elev_resp = await asyncio.gather(
                client.get(archive_url, params={**common_params, "start_date": start_date, "end_date": target_date}),
                client.get(forecast_url, params={**common_params, "past_days": 1, "forecast_days": 7}),
                client.get(elev_url, params={"latitude": lat, "longitude": lon})
            )
            
            archive_resp.raise_for_status()
            forecast_resp.raise_for_status()
            
            archive_data = archive_resp.json()
            forecast_data = forecast_resp.json()
            
            # Combine logic
            combined_daily = {
                "time": archive_data["daily"]["time"] + forecast_data["daily"]["time"][1:],
            }
            for k in archive_data["daily"]:
                if k == "time": continue
                combined_daily[k] = archive_data["daily"][k] + forecast_data["daily"][k][1:]
                
            elevation = 20.0
            if elev_resp.status_code == 200 and "elevation" in elev_resp.json():
                elevation = elev_resp.json()["elevation"][0]

            return combined_daily, elevation

    except httpx.RequestError as e:
        print(f"⚠️ API Connection Error: {e}. USING FALLBACK MOCK DATA FOR DEMO.")
        # Fallback Mock Data so the demo doesn't crash on bad WiFi
        dates = [(start_date + timedelta(days=i)).isoformat() for i in range(14)]
        mock_daily = {
            "time": dates,
            "precipitation_sum": [0.5, 2.0, 0, 0, 15.0, 45.0, 120.0, 50.0, 10.0, 0, 0, 5.0, 0, 0],
            "temperature_2m_max": [35, 34, 38, 39, 31, 29, 28, 30, 32, 34, 35, 33, 36, 37],
            "apparent_temperature_max": [38, 37, 42, 44, 34, 32, 30, 33, 35, 38, 40, 37, 41, 42],
            "wind_speed_10m_max": [10, 12, 8, 15, 25, 40, 55, 30, 15, 10, 12, 14, 8, 10],
            "wind_gusts_10m_max": [15, 18, 12, 22, 35, 55, 75, 45, 25, 15, 18, 20, 12, 15],
            "shortwave_radiation_sum": [22, 20, 24, 25, 15, 8, 5, 12, 18, 21, 23, 20, 25, 24],
            "precipitation_hours": [1, 2, 0, 0, 4, 12, 18, 8, 3, 0, 0, 1, 0, 0],
        }
        return mock_daily, 20.0


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

    if archive_resp.status_code != 200 or forecast_resp.status_code != 200:
        print(f"⚠️ Open-Meteo API Error (Rate Limit). USING FALLBACK DEMO DATA.")
        dates = [(start - timedelta(days=7 - i)).isoformat() for i in range(14)]
        mock_daily = {
            "time": dates,
            "precipitation_sum": [0.0, 1.2, 0.0, 0.0, 15.5, 45.0, 110.0, 50.0, 12.0, 0.0, 0.0, 2.0, 0.0, 0.0],
            "temperature_2m_max": [35.0, 34.5, 38.0, 39.5, 31.0, 29.0, 28.0, 30.0, 32.5, 34.0, 35.5, 33.0, 36.0, 37.0],
            "apparent_temperature_max": [38.0, 37.0, 42.0, 44.5, 34.0, 32.0, 30.0, 33.0, 35.0, 38.0, 40.0, 37.0, 41.0, 42.0],
            "wind_speed_10m_max": [10.0, 12.0, 8.0, 15.0, 25.0, 40.0, 55.0, 30.0, 15.0, 10.0, 12.0, 14.0, 8.0, 10.0],
            "wind_gusts_10m_max": [15.0, 18.0, 12.0, 22.0, 35.0, 55.0, 75.0, 45.0, 25.0, 15.0, 18.0, 20.0, 12.0, 15.0],
            "shortwave_radiation_sum": [22.0, 20.0, 24.0, 25.0, 15.0, 8.0, 5.0, 12.0, 18.0, 21.0, 23.0, 20.0, 25.0, 24.0],
            "precipitation_hours": [1.0, 2.0, 0.0, 0.0, 4.0, 12.0, 18.0, 8.0, 3.0, 0.0, 0.0, 1.0, 0.0, 0.0],
        }
        return mock_daily, 20.0

    elevation = 100.0
    if elev_resp.status_code == 200:
        elevs = elev_resp.json().get("elevation", [100.0])
        elevation = float(elevs[0]) if elevs else 100.0

    archive_daily = archive_resp.json().get("daily", {})
    forecast_daily = forecast_resp.json().get("daily", {})

    required = ["time"] + DAILY_VARS
    for key in required:
        if key not in archive_daily:
            archive_daily[key] = [0]*7
        if key not in forecast_daily:
            forecast_daily[key] = [0]*7

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
    df["rolling_7d_wind"] = df["wind_speed_10m_max"].rolling(7, min_periods=1).mean()

    # Time features
    doy = df["date"].dt.dayofyear
    df["sin_time"] = np.sin(2 * np.pi * doy / 365.25)
    df["cos_time"] = np.cos(2 * np.pi * doy / 365.25)
    df["is_weekend"] = df["date"].dt.dayofweek.isin([5, 6]).astype(int)
    df["month"] = df["date"].dt.month

    # Interaction features
    df["rain_wind_interaction"] = df["precipitation_sum"] * df["wind_speed_10m_max"]
    df["rain_squared"] = df["precipitation_sum"] ** 2
    df["wind_squared"] = df["wind_speed_10m_max"] ** 2
    df["temp_squared"] = df["temperature_2m_max"] ** 2
    df["rain_wind_ratio"] = df["precipitation_sum"] / (df["wind_speed_10m_max"] + 1)

    # v2.1: Region-discriminating features
    df["rain_intensity"] = df["precipitation_sum"] / (df["precipitation_hours"].clip(lower=0.5))
    df["rain_intensity"] = df["rain_intensity"].fillna(0).clip(0, 50)
    df["temp_humidity_gap"] = (df["apparent_temperature_max"] - df["temperature_2m_max"]).fillna(0)

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
            latitude=lat,
            longitude=lon,
        )
        df.loc[i, "trigger_rain_active"] = int(result["triggers"][0].active)
        df.loc[i, "trigger_heat_active"] = int(result["triggers"][1].active)
        df.loc[i, "trigger_storm_active"] = int(result["triggers"][2].active)
        df.loc[i, "trigger_flood_active"] = int(result["triggers"][3].active)
        df.loc[i, "trigger_visibility_active"] = int(result["triggers"][4].active)
        df.loc[i, "trigger_aqi_active"] = int(result["triggers"][5].active)
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
    day_preds: np.ndarray,
    daily_income: float,
    zone_safety: dict,
    forecast_triggers: list,
    target_date: date,
    no_claim_weeks: int = 0,
    active_days: int = 20,
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
    avg_loss_ratio = float(np.mean(day_preds))
    # Minimum loss ratio floor (actuarial base for tail risk)
    MIN_LOSS_RATIO = 0.02
    effective_ratio = max(avg_loss_ratio, MIN_LOSS_RATIO)

    # ── Uncertainty Modeling (Simpler & Smarter) ──
    # sigma -> uncertainty-based risk loading
    sigma = float(np.std(day_preds))
    # tail -> smooth multiplier based on the worst forecasted day
    max_loss_ratio = float(np.max(day_preds))
    tail_multiplier = 1.0 + 0.3 * min(max_loss_ratio / 0.4, 1.0)
    # margin -> dynamic (safe days = 10%, chaotic days = up to 25%)
    dynamic_margin = 0.10 + 0.15 * min(sigma / 0.2, 1.0)

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
        
        # Apply uncertainty, tail risk, and dynamic margin
        risk_loading = sigma * daily_income * plan["coverage_pct"] * DAYS_PER_WEEK * 0.5  # 50% std dev loading
        pure_premium = (expected_payout + risk_loading) * tail_multiplier
        base_premium = round(pure_premium * (1 + 0.15 + dynamic_margin), 2)  # 15% ops + dynamic profit margin

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

        # Final premium with floor and cap
        calculated_premium = base_premium + total_adj
        final_premium = calculated_premium
        
        # Apply Price Ceiling/Cap
        cap = MAX_WEEKLY.get(key)
        if cap is not None and final_premium > cap:
            cap_discount = round(cap - final_premium, 2)
            adjustments.append({
                "type": "price_cap_discount",
                "amount": cap_discount,
                "reason": "Platform maximum price ceiling applied to keep affordable",
            })
            total_adj += cap_discount
            final_premium = cap
            
        # Apply Minimum Floor Limit
        floor = MIN_WEEKLY.get(key, 20.0)
        if final_premium < floor:
            floor_loading = round(floor - final_premium, 2)
            adjustments.append({
                "type": "minimum_base_floor",
                "amount": floor_loading,
                "reason": "Minimum actuarial operational limit applied",
            })
            total_adj += floor_loading
            final_premium = floor

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
            "is_eligible": True if key == "basic" or active_days >= 5 else False,
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
    active_days_last_30_days: int = Field(20, ge=0, le=30)


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
    is_eligible: bool = True


class ZoneProfile(BaseModel):
    elevation_m: float
    distance_to_coast_km: float
    is_coastal: bool
    waterlogging_risk: str
    zone_safety_score: float
    weekly_discount_inr: float


class ForecastRisk(BaseModel):
    """Aggregate 7-day forecast risk metrics."""
    trigger_days_count: int
    max_simultaneous_triggers: int
    coverage_extended: bool
    forecast_summary: str
    daily_risks: list[float]  # Exposed for real-time tracking graphs


class PremiumResponse(BaseModel):
    latitude: float
    longitude: float
    daily_income_inr: float
    date: str
    zone_profile: ZoneProfile
    all_triggers_today: List[TriggerInfo]
    forecast_risk: ForecastRisk
    forecast_loss_ratio_7d: float
    disruption_risk: str
    plans: dict
    model_version: str
    model_r2: float
    is_suspended: bool
    today_weather: Optional[dict] = None


# ── Authentication Models (Added for Auth Endpoints) ──

class AuthRequest(BaseModel):
    email: str
    password: str

class FirebaseAuthRequest(BaseModel):
    email: str
    firebase_token: str
    name: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: str

class AuthResponse(BaseModel):
    status: str
    user_id: str
    message: str
    access_token: str
    token_type: str = "bearer"

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[str] = None
    mobile: Optional[str] = None
    pincode: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    gig_id: Optional[str] = None
    gig_verified: Optional[bool] = None
    active_days_last_30_days: Optional[int] = None
    coverage_start_hour: Optional[int] = None

class PolicyPurchaseRequest(BaseModel):
    tier: str
    premium_paid: float
    latitude: float
    longitude: float
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None

class PayoutSimulationRequest(BaseModel):
    amount: float
    trigger_name: str

class RazorpayOrderRequest(BaseModel):
    tier: str
    amount: float  # in INR

class PushTokenRequest(BaseModel):
    expo_push_token: str

class UserLocationUpdate(BaseModel):
    latitude: float
    longitude: float
    altitude: float = 0.0


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

@app.get("/")
async def read_root():
    return {
        "status": "online",
        "service": "GigShield API v2",
        "message": "Welcome to GigShield/GudieWire Backend. Live on Render! 🎉",
        "docs_url": "/docs"
    }

@app.get("/health")
async def health(request: Request):
    """Returns DB connection status alongside ML model health."""
    db_status = "ok"
    try:
        await request.app.mongodb_client.admin.command('ping')
    except Exception:
        db_status = "disconnected"

    return {
        "status": "ok",
        "db_status": db_status,
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
        latitude=lat,
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
            latitude=lat,
        )
        forecast_triggers.append(day_result["triggers"])

    n_trigger_days = sum(1 for day_t in forecast_triggers if any(t.active for t in day_t))
    max_sim = max((sum(1 for t in day_t if t.active) for day_t in forecast_triggers), default=0)

    # ── Dynamic Pricing ──
    plans = compute_dynamic_premium(
        day_preds=day_preds,
        daily_income=income,
        zone_safety=zone_safety,
        forecast_triggers=forecast_triggers,
        target_date=target_date,
        no_claim_weeks=req.no_claim_weeks,
        active_days=req.active_days_last_30_days,
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
        all_triggers_today=[
            TriggerInfo(
                trigger_id=t.trigger_id,
                trigger_name=t.trigger_name,
                icon=t.icon,
                active=t.active,
                severity=t.severity,
                loss_multiplier=t.loss_multiplier,
                description=t.description,
            )
            for t in today_result["triggers"]
        ],
        forecast_risk=ForecastRisk(
            trigger_days_count=n_trigger_days,
            max_simultaneous_triggers=max_sim,
            coverage_extended=coverage_extended,
            forecast_summary=forecast_summary,
            daily_risks=[round(float(r), 4) for r in day_preds],
        ),
        forecast_loss_ratio_7d=round(max(avg_loss_ratio, 0.02), 4),
        disruption_risk=risk_label(avg_loss_ratio),
        plans=plans,
        model_version=MODEL_META.get("version", "v1_fallback"),
        model_r2=MODEL_META.get("test_r2", 0),
        is_suspended=float(avg_loss_ratio) > 0.85,
        today_weather={
            "precipitation_mm": round(float(today_weather.get("precipitation_sum", 0)), 1),
            "rain_threshold_mm": 20.0,
            "temp_max_c": round(float(today_weather.get("temperature_2m_max", 30)), 1),
            "heat_threshold_c": 42.0,
            "apparent_temp_c": round(float(today_weather.get("apparent_temperature_max", 32)), 1),
            "wind_speed_max_kmh": round(float(today_weather.get("wind_speed_10m_max", 10)), 1),
            "wind_threshold_kmh": 50.0,
            "wind_gust_max_kmh": round(float(today_weather.get("wind_gusts_10m_max", 15)), 1),
            "radiation_mj": round(float(today_weather.get("shortwave_radiation_sum", 15)), 1),
            "rolling_7d_rain_mm": round(float(today_weather.get("rolling_7d_rain", 0)), 1),
            "flood_rain_threshold_mm": 100.0,
            "rolling_3d_temp_c": round(float(today_weather.get("rolling_3d_temp", 30)), 1),
            "elevation_m": round(elevation, 1),
            "distance_to_coast_km": round(dist_coast, 1),
        },
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
        latitude=lat,
        longitude=lon,
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
# AUTHENTICATION ROUTES (MongoDB Integration)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=AuthResponse)
async def register_user(req: AuthRequest, request: Request):
    """
    Register a new user into the MongoDB database.
    (Added to let you easily create dummy accounts for the Mobile App)
    """
    db = request.app.mongodb
    
    # 1. Validate email format
    email_regex = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    if not re.match(email_regex, req.email):
        raise HTTPException(
            status_code=400,
            detail="Invalid email address format."
        )

    # 2. Validate password strength
    password_regex = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$"
    if not re.match(password_regex, req.password):
        raise HTTPException(
            status_code=400, 
            detail="Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character."
        )

    # 2. Check if user already exists
    existing_user = await db["users"].find_one({"email": req.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists with this email")
    
    # 3. Hash the password before saving for security
    hashed_password = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_doc = {
        "email": req.email,
        "hashed_password": hashed_password,
        "gig_rider_id": generate_gig_id(),
        "created_at": datetime.now(timezone.utc)
    }
    
    # 3. Save to the database
    result = await db["users"].insert_one(user_doc)
    
    # 4. Generate secure JWT token
    access_token = create_access_token(data={"sub": str(result.inserted_id)})
    
    return AuthResponse(
        status="success",
        user_id=str(result.inserted_id),
        message="User successfully registered.",
        access_token=access_token
    )


@app.post("/auth/login", response_model=AuthResponse)
async def login_user(req: AuthRequest, request: Request):
    """
    Authenticate a user against the MongoDB collection for the Mobile App login frontend.
    """
    db = request.app.mongodb
    
    # 1. Fetch user by email
    user = await db["users"].find_one({"email": req.email})
    
    # 2. Verify existence and check that the hash matches the plaintext password
    if not user or not bcrypt.checkpw(req.password.encode('utf-8'), user["hashed_password"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    # 3. Generate secure JWT token
    access_token = create_access_token(data={"sub": str(user["_id"])})
    
    # 4. Return success payload required by Mobile App
    return AuthResponse(
        status="success",
        user_id=str(user["_id"]),
        message="Login successful.",
        access_token=access_token
    )

@app.post("/auth/firebase-sync", response_model=AuthResponse)
async def firebase_sync(req: FirebaseAuthRequest, request: Request):
    """
    Syncs a Firebase user with our MongoDB database. 
    Uses the Firebase UID as the unique identifier.
    """
    db = request.app.mongodb
    
    # In a production app, we would verify the 'firebase_token' here using firebase-admin.
    # For the hackathon, we will use the email to find/create the user profile.
    
    user = await db["users"].find_one({"email": req.email})
    
    if not user:
        # Create a new user entry for this Firebase UID
        user_doc = {
            "email": req.email,
            "name": req.name or "Rider Persona",
            "firebase_uid": req.firebase_token, # We'll store the UID here for simplicity
            "gig_rider_id": generate_gig_id(),
            "created_at": datetime.now(timezone.utc),
            "is_verified": True, # Firebase handles verification
            "active_days_last_30_days": 20,  # Default for demo — enables Standard/Premium eligibility
            "trust_score": 50.0,  # Unified Trust Score — starts at Trusted tier
        }
        result = await db["users"].insert_one(user_doc)
        user_id = str(result.inserted_id)
        message = "Profile created successfully."
    else:
        user_id = str(user["_id"])
        message = "Profile synced successfully."
        # Update name if provided and not already set
        if req.name and not user.get("name"):
            await db["users"].update_one({"_id": user["_id"]}, {"$set": {"name": req.name}})

    access_token = create_access_token(data={"sub": user_id})
    
    return AuthResponse(
        status="success",
        user_id=user_id,
        message=message,
        access_token=access_token
    )


@app.get("/auth/me")
async def get_my_profile(request: Request):
    """
    Fetch the current user profile from MongoDB using the JWT token.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    db = request.app.mongodb
    from bson import ObjectId
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Convert ObjectId to string for JSON serialization
    user["id"] = str(user["_id"])
    del user["_id"]
    if "hashed_password" in user:
        del user["hashed_password"]
    
    # Normalize collections to prevent 'undefined' on frontend
    user["payout_history"] = user.get("payout_history", [])
    user["policy_history"] = user.get("policy_history", [])
        
    return user


@app.post("/auth/profile/update")
async def update_profile(req: UserProfileUpdate, request: Request):
    """
    Update the user's profile information in MongoDB.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    db = request.app.mongodb
    from bson import ObjectId
    
    # Convert model to dict and remove null values
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"status": "success", "message": "Profile updated successfully"}


@app.post("/policy/order")
async def create_razorpay_order(req: RazorpayOrderRequest, request: Request):
    """
    Creates a Razorpay Sandbox order for premium collection.
    The mobile app uses this order_id to open the Razorpay checkout.
    """
    if not razorpay_client:
        raise HTTPException(status_code=503, detail="Payment gateway not configured")

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    try:
        amount_paise = int(round(req.amount * 100))  # Razorpay uses paise
        order_data = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"gg_{req.tier}_{int(datetime.now().timestamp())}",
            "notes": {
                "plan": req.tier,
                "product": "GigGuard Parametric Insurance"
            }
        }
        order = razorpay_client.order.create(data=order_data)
        print(f"✅ Razorpay Order created: {order['id']} for ₹{req.amount}")
        return {
            "order_id": order["id"],
            "amount": req.amount,
            "amount_paise": amount_paise,
            "currency": "INR",
            "key_id": RAZORPAY_KEY_ID,
        }
    except Exception as e:
        print(f"❌ Razorpay order creation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Payment gateway error: {str(e)}")


from fastapi.responses import HTMLResponse

@app.get("/razorpay/checkout", response_class=HTMLResponse)
async def razorpay_checkout_page(order_id: str, key_id: str, amount: int, plan: str):
    """
    Serves a minimal HTML page that loads the Razorpay JS SDK checkout.
    Opened via expo-web-browser from the mobile app.
    After payment, user closes the browser and returns to the app.
    """
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GigGuard Payment</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
            background: linear-gradient(135deg, #0a0e1a 0%, #1a1f2e 100%);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }}
        .card {{
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            padding: 40px 30px;
            text-align: center;
            max-width: 400px;
            width: 100%;
            backdrop-filter: blur(20px);
        }}
        .shield {{ font-size: 48px; margin-bottom: 16px; }}
        h1 {{ font-size: 22px; margin-bottom: 8px; font-weight: 700; }}
        .plan {{ color: #F59E0B; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 24px; }}
        .amount {{ font-size: 36px; font-weight: 800; color: #F59E0B; margin-bottom: 8px; }}
        .subtitle {{ color: rgba(255,255,255,0.5); font-size: 13px; margin-bottom: 32px; }}
        .pay-btn {{
            background: #F59E0B;
            color: #000;
            border: none;
            padding: 16px 48px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            width: 100%;
            transition: all 0.2s;
        }}
        .pay-btn:hover {{ transform: scale(1.02); background: #FBBF24; }}
        .pay-btn:disabled {{ opacity: 0.5; cursor: not-allowed; }}
        .secured {{ color: rgba(255,255,255,0.3); font-size: 11px; margin-top: 20px; }}
        .success-container {{ display: none; }}
        .success-container.show {{ display: block; }}
        .success-icon {{ font-size: 64px; margin-bottom: 16px; }}
        .success-text {{ color: #00FF88; font-size: 20px; font-weight: 700; margin-bottom: 8px; }}
        .close-hint {{ color: rgba(255,255,255,0.4); font-size: 13px; margin-top: 24px; }}
    </style>
</head>
<body>
    <div class="card">
        <div id="checkout-view">
            <div class="shield">🛡️</div>
            <h1>GigGuard Insurance</h1>
            <div class="plan">{plan} Plan · Weekly Coverage</div>
            <div class="amount">₹{amount // 100}</div>
            <div class="subtitle">Razorpay Sandbox · Secure Test Payment</div>
            <button class="pay-btn" id="payBtn" onclick="openRazorpay()">
                🔒 Pay ₹{amount // 100} Securely
            </button>
            <div class="secured">🔐 256-bit SSL · Razorpay Sandbox · RBI Compliant</div>
        </div>
        <div id="success-view" class="success-container">
            <div class="success-icon">✅</div>
            <div class="success-text">Payment Successful!</div>
            <div class="subtitle">Your {plan} plan premium has been collected.</div>
            <div class="close-hint">You can close this window and return to the app.</div>
        </div>
    </div>

    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <script>
        function openRazorpay() {{
            document.getElementById('payBtn').disabled = true;
            document.getElementById('payBtn').textContent = 'Opening gateway...';

            var options = {{
                "key": "{key_id}",
                "amount": "{amount}",
                "currency": "INR",
                "name": "GigGuard Insurance",
                "description": "{plan.capitalize()} Plan · Weekly Parametric Coverage",
                "order_id": "{order_id}",
                "handler": function(response) {{
                    // Payment successful
                    document.getElementById('checkout-view').style.display = 'none';
                    document.getElementById('success-view').classList.add('show');
                    console.log('Payment ID:', response.razorpay_payment_id);
                    console.log('Signature:', response.razorpay_signature);
                }},
                "prefill": {{
                    "name": "GigGuard Rider",
                    "email": "rider@gigguard.in",
                    "contact": "9999999999"
                }},
                "theme": {{
                    "color": "#F59E0B"
                }},
                "modal": {{
                    "ondismiss": function() {{
                        document.getElementById('payBtn').disabled = false;
                        document.getElementById('payBtn').textContent = '🔒 Pay ₹{amount // 100} Securely';
                    }}
                }}
            }};
            var rzp = new Razorpay(options);
            rzp.open();
        }}
    </script>
</body>
</html>"""

@app.post("/policy/purchase")
async def purchase_policy(req: PolicyPurchaseRequest, request: Request):
    """
    Record a policy purchase and activate coverage for 7 days.
    If Razorpay fields are provided, verify the payment signature first.
    Falls back to direct activation if no Razorpay fields (backward compat).
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    # ── Verify Razorpay Signature (if provided) ──
    payment_verified = False
    if req.razorpay_order_id and req.razorpay_payment_id and req.razorpay_signature:
        try:
            razorpay_client.utility.verify_payment_signature({
                "razorpay_order_id": req.razorpay_order_id,
                "razorpay_payment_id": req.razorpay_payment_id,
                "razorpay_signature": req.razorpay_signature,
            })
            payment_verified = True
            print(f"✅ Razorpay payment verified: {req.razorpay_payment_id}")
        except razorpay.errors.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Payment signature verification failed")

    db = request.app.mongodb
    from bson import ObjectId

    # Calculate expiry (7 days from now)
    now = datetime.now(timezone.utc)
    expiry = now + timedelta(days=7)

    policy_doc = {
        "tier": req.tier,
        "premium_paid": req.premium_paid,
        "baseline_latitude": req.latitude,
        "baseline_longitude": req.longitude,
        "activated_at": now,
        "expires_at": expiry,
        "status": "active",
        "payment_verified": payment_verified,
        "razorpay_payment_id": req.razorpay_payment_id,
    }

    # Update user with active policy and add to history
    result = await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {"active_policy": policy_doc},
            "$push": {"policy_history": policy_doc}
        }
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "status": "success",
        "message": f"Successfully activated {req.tier} coverage",
        "payment_verified": payment_verified,
        "expires_at": expiry
    }


@app.post("/policy/payout/simulate")
async def simulate_payout(req: PayoutSimulationRequest, request: Request):
    """
    Simulate an automated parametric payout with fraud checks and rollback.
    
    Settlement flow (DEVTrails spec):
      1. Trigger confirmed  — caller has already verified weather breach
      2. Eligibility check   — active policy + correct zone + JWT auth
      3. Fraud check         — no duplicate claim in last 24h for same trigger
      4. Transfer initiated  — write payout record to DB
      5. Record updated      — return confirmation (or pending on failure)
    """
    # ── Step 1: Auth ──
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    db = request.app.mongodb
    from bson import ObjectId

    # ── Step 2: Eligibility — check active policy exists ──
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    active_policy = user.get("active_policy")
    if active_policy:
        expires_at = active_policy.get("expires_at")
        if expires_at and isinstance(expires_at, datetime):
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < datetime.now(timezone.utc):
                raise HTTPException(status_code=403, detail="Policy expired. Renew coverage to receive payouts.")
    
    # ── Step 3: Fraud check — no duplicate claim for same trigger in 24h ──
    payout_history = user.get("payout_history", [])
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    for past_payout in payout_history:
        past_time = past_payout.get("paid_at")
        past_trigger = past_payout.get("trigger_name", "")
        if past_trigger == req.trigger_name and isinstance(past_time, datetime):
            if past_time.tzinfo is None:
                past_time = past_time.replace(tzinfo=timezone.utc)
            if past_time > cutoff:
                raise HTTPException(
                    status_code=409,
                    detail=f"Duplicate claim: '{req.trigger_name}' payout already settled within 24 hours."
                )
    
    # ── Step 4: Initiate transfer with rollback on failure ──
    payout_doc = {
        "payout_id": f"PAY-{int(datetime.now().timestamp())}",
        "amount": req.amount,
        "trigger_name": req.trigger_name,
        "paid_at": datetime.now(timezone.utc),
        "status": "settled"
    }
    
    try:
        result = await db["users"].update_one(
            {"_id": ObjectId(user_id)},
            {"$push": {"payout_history": payout_doc}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found during transfer")
    except HTTPException:
        raise
    except Exception as e:
        # ── Rollback: mark as pending so client can retry ──
        payout_doc["status"] = "pending"
        payout_doc["retry_id"] = f"RETRY-{int(datetime.now().timestamp())}"
        return {
            "status": "pending",
            "message": f"Transfer failed mid-way. Retry with ID {payout_doc['retry_id']}",
            "payout": payout_doc,
            "error": str(e)
        }

    # ── Step 5: Record updated — confirmation ──
    return {
        "status": "success", 
        "message": f"Successfully settled ₹{req.amount} payout via UPI",
        "payout": payout_doc,
        "settlement_time_seconds": 3  # Simulated instant settlement
    }


# ─────────────────────────────────────────────────────────────────────────────
# PUSH TOKEN & LOCATION STORAGE
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/user/push-token")
async def register_push_token(req: PushTokenRequest, request: Request):
    """Store the Expo Push Token for the logged-in user."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    db = request.app.mongodb
    from bson import ObjectId
    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"expo_push_token": req.expo_push_token}}
    )
    return {"status": "success", "message": "Push token registered"}


@app.post("/user/location")
async def update_user_location(req: UserLocationUpdate, request: Request):
    """Store the user's latest GPS location for autopay trigger scanning."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    db = request.app.mongodb
    from bson import ObjectId
    now_time = datetime.now(timezone.utc)
    req_ip = request.client.host
    
    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "last_latitude": req.latitude,
                "last_longitude": req.longitude,
                "last_altitude": req.altitude,
                "last_ip": req_ip,
                "location_updated_at": now_time,
            },
            "$push": {
                "location_history": {
                    "$each": [{
                        "lat": req.latitude,
                        "lon": req.longitude,
                        "alt": req.altitude,
                        "time": now_time
                    }],
                    "$slice": -5
                }
            }
        }
    )
    return {"status": "success"}


# ─────────────────────────────────────────────────────────────────────────────
# AUTOPAY SCHEDULER — The core parametric insurance engine
# ─────────────────────────────────────────────────────────────────────────────

async def send_expo_push(token: str, title: str, body: str, data: dict = None):
    """Send a push notification via Expo Push API."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json={
                    "to": token,
                    "title": title,
                    "body": body,
                    "sound": "default",
                    "data": data or {},
                },
            )
            print(f"📱 Push sent to {token[:20]}... → {resp.status_code}")
    except Exception as e:
        print(f"⚠️ Push notification failed: {e}")


async def execute_razorpayx_payout_mock(user_id: str, amount: float, purpose: str) -> dict:
    """
    Simulates sending a real Bank/UPI payout via RazorpayX Sandbox API.
    Used to prove the '10-Second Auto-Settlement' architecture during hackathons.
    """
    import asyncio
    
    print(f"\n   💳 [RAZORPAY_X] Initiating Payout...")
    print(f"   ├─ Amount: ₹{amount}")
    print(f"   ├─ Purpose: Parametric Trigger - {purpose}")
    print(f"   ├─ Connecting to Bank NEFT/UPI nodes...")
    
    # Simulate network delay for Bank node verification (1-3 seconds)
    await asyncio.sleep(2.5)
    
    # Mock UPI UTR generation
    utr_id = f"UPI{int(datetime.now().timestamp())}{user_id[-4:].upper()}"
    payout_id = f"pout_{int(datetime.now().timestamp())}XYZ"
    
    print(f"   └─ ✅ SUCCESS! Settlement complete. UTR: {utr_id}")
    
    return {
        "status": "processed",
        "razorpay_payout_id": payout_id,
        "utr": utr_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


async def autopay_trigger_scan():
    """
    Scheduled job that runs every 5 minutes:
    1. Finds all users with active (non-expired) policies + stored GPS
    2. Fetches current weather for their location
    3. Evaluates triggers
    4. If any trigger fires → auto-settles payout into MongoDB
    5. Sends push notification to user
    """
    print("\n🔄 ── AUTOPAY SCAN STARTED ──")
    db = app.mongodb
    now = datetime.now(timezone.utc)

    # Find all users with active policies that haven't expired
    cursor = db["users"].find({
        "active_policy.status": "active",
        "active_policy.expires_at": {"$gt": now},
        "last_latitude": {"$exists": True},
        "last_longitude": {"$exists": True},
    })

    users = await cursor.to_list(length=500)
    print(f"   Found {len(users)} users with active policies + GPS")

    for user in users:
        try:
            lat = user["last_latitude"]
            lon = user["last_longitude"]
            user_id = str(user["_id"])
            policy = user["active_policy"]
            email = user.get("email", "unknown")
            trust = user.get("trust_score", 50.0)
            tier = get_trust_tier(trust)
            
            print(f"   {tier['emoji']} [{tier['label']}] Scanning {email} (Trust: {trust:.0f}/100)")
            
            # --- TRUST-ADAPTIVE VESTING (replaces static 12h rule) ---
            activated_at_naive = policy.get("activated_at")
            if activated_at_naive:
                if activated_at_naive.tzinfo is None:
                    activated_at_naive = activated_at_naive.replace(tzinfo=timezone.utc)
                vesting_seconds = tier["vesting_hours"] * 3600.0
                if (now - activated_at_naive).total_seconds() < vesting_seconds:
                    print(f"   🛡️ [VESTING] Payout skipped for {email}: {tier['vesting_hours']}h cooling-off ({tier['label']} tier).")
                    continue

            # ── GEOSPATIAL FRAUD DEFENSE: The 40km Anchor Rule ──
            baseline_lat = policy.get("baseline_latitude")
            baseline_lon = policy.get("baseline_longitude")
            
            if baseline_lat is not None and baseline_lon is not None:
                dist_km = haversine_distance(lat, lon, baseline_lat, baseline_lon)
                if dist_km > 40.0:
                    # Teleportation → punish trust score
                    new_trust = max(0.0, trust - 25.0)
                    await db["users"].update_one({"_id": user["_id"]}, {"$set": {"trust_score": new_trust}})
                    print(f"   🚨 [FRAUD SHIELD] Payout Blocked for {email}: Teleported {dist_km:.1f}km. Trust: {trust:.0f}→{new_trust:.0f}")
                    continue
                    
            # Fetch real-time weather & elevation FIRST for topographical check
            weather, elevation = await fetch_weather_and_elevation(lat, lon)
            
            # --- EVALUATE COMPOSITE FRAUD ENGINE ---
            async with httpx.AsyncClient(timeout=5.0) as client:
                verdict = await evaluate_composite_fraud_score(client, user, lat, lon, elevation)
            
            fraud_score = verdict["score"]
            
            if verdict["details"]:
                for d in verdict["details"]:
                    print(f"      ├─ {d}")
                    
            if fraud_score >= 60:
                new_trust = max(0.0, trust - 25.0)
                await db["users"].update_one({"_id": user["_id"]}, {"$set": {"trust_score": new_trust}})
                print(f"   🚨 [FRAUD SHIELD] Payout Blocked for {email}: Score {fraud_score}/100. Trust: {trust:.0f}→{new_trust:.0f}")
                continue
            elif fraud_score >= 30:
                new_trust = max(0.0, trust - 10.0)
                await db["users"].update_one({"_id": user["_id"]}, {"$set": {"trust_score": new_trust}})
                print(f"   ⚠️ [FRAUD WARNING] {email}: Score {fraud_score}/100. Trust: {trust:.0f}→{new_trust:.0f}. Flagged for audit.")

            dist_coast = distance_to_coast_km(lat, lon)
            coastal = dist_coast < 80

            # Get today's index (first forecast day = index 7)
            today_idx = min(7, len(weather["time"]) - 1)

            # Evaluate triggers for today
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
                latitude=lat,
                longitude=lon,
            )

            if not result["any_active"]:
                continue  # No triggers fired — skip

            # ── Which triggers fired? ──
            active_triggers = [t for t in result["triggers"] if t.active]
            trigger_names = ", ".join(t.trigger_name for t in active_triggers)
            print(f"   ⚡ TRIGGER for {email}: {trigger_names}")

            # ── Fraud check: no duplicate payout for same trigger in 24h ──
            payout_history = user.get("payout_history", [])
            cutoff = now - timedelta(hours=24)
            already_paid_triggers = set()
            for past_payout in payout_history:
                past_time = past_payout.get("paid_at")
                if isinstance(past_time, datetime):
                    if past_time.tzinfo is None:
                        past_time = past_time.replace(tzinfo=timezone.utc)
                    if past_time > cutoff:
                        already_paid_triggers.add(past_payout.get("trigger_name", ""))

            # Only settle triggers that haven't been paid in last 24h
            new_triggers = [t for t in active_triggers if t.trigger_name not in already_paid_triggers]
            if not new_triggers:
                print(f"   ⏭  {email}: triggers already settled within 24h")
                continue

            # ── Calculate payout amount ──
            plan_config = PLANS.get(policy.get("tier", "basic"), PLANS["basic"])
            daily_income = 800  # Default daily income estimate
            payout_amount = round(
                daily_income * plan_config["coverage_pct"] * result["composite_loss_ratio"],
                2
            )
            payout_amount = max(payout_amount, 10.0)  # Min ₹10 payout

            primary_trigger = new_triggers[0].trigger_name
            
            # --- LAYER 7: CLAIM FARMING VELOCITY LIMITER (Flash Crash Circuit Breaker) ---
            global GLOBAL_PAYOUT_FREEZE
            if GLOBAL_PAYOUT_FREEZE:
                print("   🚫 [CIRCUIT BREAKER] Payout halted - System in Admin Freeze state!")
                continue
                
            # Clean up old tracking data (>5 mins)
            while GLOBAL_PAYOUT_VELOCITY_TRACKER and GLOBAL_PAYOUT_VELOCITY_TRACKER[0]["time"] < now - timedelta(minutes=5):
                GLOBAL_PAYOUT_VELOCITY_TRACKER.popleft()
                
            aggregate_5m_payout = sum(p["amount"] for p in GLOBAL_PAYOUT_VELOCITY_TRACKER)
            
            if aggregate_5m_payout + payout_amount > MAX_PAYOUT_PER_5_MINS:
                GLOBAL_PAYOUT_FREEZE = True
                print(f"\n   🚨🚨 [FATAL SECURITY EVENT] FLASH CRASH CIRCUIT BREAKER TRIPPED! 🚨🚨")
                print(f"   Aggregated payouts (₹{aggregate_5m_payout}) + requested (₹{payout_amount}) exceeds ₹{MAX_PAYOUT_PER_5_MINS}/5min limit.")
                print(f"   ALL AUTOPAYS SUSPENDED UNTIL SECURITY AUDIT!\n")
                break # Hard exit from the loop!

            # ── 10-Second Auto-Settlement Simulation (RazorpayX Payouts) ──
            rp_result = await execute_razorpayx_payout_mock(
                user_id=user_id,
                amount=payout_amount,
                purpose=primary_trigger
            )
            
            # Register payout in global velocity tracker
            GLOBAL_PAYOUT_VELOCITY_TRACKER.append({"time": now, "amount": payout_amount})

            # ── Write payout to DB ──
            payout_doc = {
                "payout_id": rp_result["razorpay_payout_id"],
                "utr_ref": rp_result["utr"],
                "amount": payout_amount,
                "trigger_name": primary_trigger,
                "all_triggers": [t.trigger_name for t in new_triggers],
                "paid_at": now,
                "status": rp_result["status"],
                "autopay": True,
                "fraud_score_at_settlement": fraud_score,
                "trust_score_at_settlement": trust,
            }

            # ── TRUST REWARD: Honest payout → trust goes UP ──
            new_trust = min(100.0, trust + 3.0)
            
            from bson import ObjectId
            await db["users"].update_one(
                {"_id": ObjectId(user_id)},
                {
                    "$push": {"payout_history": payout_doc},
                    "$set": {"trust_score": new_trust},
                }
            )
            print(f"   ✅ DB WRITE: Auto-settled ₹{payout_amount} for {email} ({primary_trigger}) | Trust: {trust:.0f}→{new_trust:.0f}")

            # ── Send Push Notification ──
            push_token = user.get("expo_push_token")
            if push_token:
                await send_expo_push(
                    token=push_token,
                    title=f"₹{payout_amount} Settled! ✅",
                    body=f"{primary_trigger} detected in your zone. Claim auto-settled to your GigGuard wallet.",
                    data={"payout_id": payout_doc["payout_id"], "screen": "Passbook"},
                )

        except Exception as e:
            print(f"   ❌ Error processing user {user.get('email', '?')}: {e}")
            continue

    print("🔄 ── AUTOPAY SCAN COMPLETE ──\n")


# ─────────────────────────────────────────────────────────────────────────────
# RUN
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
