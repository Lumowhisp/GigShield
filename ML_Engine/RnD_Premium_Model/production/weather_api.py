"""
╔══════════════════════════════════════════════════════════════╗
║  weather_api.py — Open-Meteo Forecast + History Fetcher     ║
║  Fetches 7-day forecast + 7-day history for rolling features║
╚══════════════════════════════════════════════════════════════╝
"""

import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


def fetch_weather(lat: float, lon: float) -> pd.DataFrame:
    """
    Fetch 7 days of historical weather + 7 days of forecast.

    Why both?
      - rolling_7d_rain needs past 7 days of precipitation
      - rolling_3d_temp needs past 3 days of temperature
      - Forecast gives us the upcoming week for premium calculation

    Returns a DataFrame with 14 rows (7 past + 7 future), columns matching
    the exact variable names used during training.
    """
    # ── Single Call for Both Past & Future ──
    # The normal forecast API supports past_days=7 which avoids the 
    # 400 Error on the archive API which has a 2-day data lag.
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": [
            "temperature_2m_max",
            "apparent_temperature_max",
            "precipitation_sum",
            "rain_sum",
            "precipitation_hours",
            "wind_speed_10m_max",
            "wind_gusts_10m_max",
            "shortwave_radiation_sum",
        ],
        "timezone": "Asia/Kolkata",
        "past_days": 7,
        "forecast_days": 7,
    }

    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    # Parse into DataFrame
    df = _parse_daily_response(data)
    df = df.sort_values("date").reset_index(drop=True)

    return df


def _parse_daily_response(data: dict) -> pd.DataFrame:
    """Parse Open-Meteo JSON response into a clean DataFrame."""
    daily = data.get("daily", {})

    df = pd.DataFrame({
        "date": pd.to_datetime(daily.get("time", [])),
        "temperature_2m_max": daily.get("temperature_2m_max", []),
        "apparent_temperature_max": daily.get("apparent_temperature_max", []),
        "precipitation_sum": daily.get("precipitation_sum", []),
        "rain_sum": daily.get("rain_sum", []),
        "precipitation_hours": daily.get("precipitation_hours", []),
        "wind_speed_10m_max": daily.get("wind_speed_10m_max", []),
        "wind_gusts_10m_max": daily.get("wind_gusts_10m_max", []),
        "shortwave_radiation_sum": daily.get("shortwave_radiation_sum", []),
    })

    # Fill nulls safely (some forecast fields can be None)
    df = df.fillna(0)

    return df
