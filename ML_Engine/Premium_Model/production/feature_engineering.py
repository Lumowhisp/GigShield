"""
╔══════════════════════════════════════════════════════════════╗
║  feature_engineering.py — Exact Match to Training Pipeline  ║
║  Must produce identical features as generate_daily_risk_data║
╚══════════════════════════════════════════════════════════════╝

CRITICAL: Any mismatch between training and inference features
will silently produce garbage predictions. This module replicates
the EXACT feature engineering from generate_daily_risk_data.py v4.
"""

import pandas as pd
import numpy as np
from math import radians, sin, cos, sqrt, atan2


# ── City coordinates for nearest-city mapping ──
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

CITY_INCOME_MAP = {
    "Mumbai": 950, "Delhi": 900, "Bengaluru": 880, "Hyderabad": 820,
    "Ahmedabad": 780, "Chennai": 800, "Kolkata": 750,
    "Surat": 760, "Pune": 830, "Jaipur": 720,
}

CITY_MAX_RADIATION = {
    "Mumbai": 22, "Delhi": 25, "Bengaluru": 21, "Hyderabad": 23,
    "Ahmedabad": 26, "Chennai": 22, "Kolkata": 22,
    "Surat": 23, "Pune": 22, "Jaipur": 26,
}


def haversine_km(lat1, lon1, lat2, lon2):
    """Haversine distance between two lat/lon points in km."""
    R = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))


def find_nearest_city(lat: float, lon: float) -> str:
    """
    Map any lat/lon to the nearest training city.

    Why: The model was trained with one-hot city columns (city_Mumbai, etc).
    For arbitrary lat/lon, we find the nearest city and activate its column.
    This preserves city-specific risk patterns the model learned.
    """
    distances = {
        city: haversine_km(lat, lon, coords["lat"], coords["lon"])
        for city, coords in CITIES.items()
    }
    return min(distances, key=distances.get)


def build_features(weather_df: pd.DataFrame, lat: float, lon: float, feature_cols: list) -> pd.DataFrame:
    """
    Build ML features from weather DataFrame.

    MUST match the EXACT feature engineering from training:
      1. precipitation_sum clipped to [0, 150]
      2. rolling_7d_rain = 7-day rolling sum of precipitation
      3. rolling_3d_temp = 3-day rolling mean of temperature
      4. sin_time, cos_time = cyclical day-of-year encoding
      5. seasonal_factor = 1.1 for monsoon months (Jun-Sep), else 1.0
      6. Interaction features (rain*wind, rain², wind², temp², etc.)
      7. tail_event = catastrophic weather binary flag
      8. One-hot city encoding

    Args:
        weather_df: DataFrame with raw weather columns (14 rows: 7 past + 7 future)
        lat, lon: User coordinates for city mapping
        feature_cols: Exact feature column list from the trained model

    Returns:
        DataFrame with 7 rows (forecast days only), columns matching feature_cols
    """
    df = weather_df.copy()

    # ── Step 1: Clip precipitation (matches training) ──
    df["precipitation_sum"] = df["precipitation_sum"].clip(0, 150)

    # ── Step 2: Rolling features (computed over full 14-day window) ──
    df["rolling_7d_rain"] = df["precipitation_sum"].rolling(window=7, min_periods=1).sum()
    df["rolling_3d_temp"] = df["temperature_2m_max"].rolling(window=3, min_periods=1).mean()

    # ── Step 3: Time encoding ──
    day_of_year = df["date"].dt.dayofyear
    df["sin_time"] = np.sin(2 * np.pi * day_of_year / 365.25)
    df["cos_time"] = np.cos(2 * np.pi * day_of_year / 365.25)

    # ── Step 4: Seasonal factor ──
    df["seasonal_factor"] = df["date"].dt.month.apply(
        lambda m: 1.1 if m in [6, 7, 8, 9] else 1.0
    )

    # ── Step 5: Humidity proxy ──
    nearest_city = find_nearest_city(lat, lon)
    max_rad = CITY_MAX_RADIATION.get(nearest_city, 24)
    df["humidity_proxy"] = (1 - (df["shortwave_radiation_sum"] / max_rad)).clip(0, 1)

    # ── Step 6: Interaction features (MUST match training exactly) ──
    df["rain_wind_interaction"] = df["precipitation_sum"] * df["wind_speed_10m_max"]
    df["rain_squared"] = df["precipitation_sum"] ** 2
    df["wind_squared"] = df["wind_speed_10m_max"] ** 2
    df["temp_squared"] = df["temperature_2m_max"] ** 2
    df["rain_wind_ratio"] = df["precipitation_sum"] / (df["wind_speed_10m_max"] + 1)
    df["heat_index_proxy"] = df["temperature_2m_max"] * df["humidity_proxy"]

    # ── Step 7: Tail event (catastrophic weather flag) ──
    df["tail_event"] = (
        (df["precipitation_sum"] > 100) |
        (df["temperature_2m_max"] > 45) |
        (df["wind_speed_10m_max"] > 60)
    ).astype(int)

    # ── Step 8: One-hot city encoding ──
    for city in CITIES:
        df[f"city_{city}"] = 1 if city == nearest_city else 0

    # ── Keep only forecast days (last 7 rows) ──
    # The first 7 days were only for rolling window context
    forecast_df = df.tail(7).copy()

    # ── Align to model's expected column order ──
    for col in feature_cols:
        if col not in forecast_df.columns:
            forecast_df[col] = 0.0

    result = forecast_df[feature_cols].fillna(0)

    return result, nearest_city


def get_base_income(city: str) -> float:
    """Get the per-city base daily income used in the training pipeline."""
    return CITY_INCOME_MAP.get(city, 800)
