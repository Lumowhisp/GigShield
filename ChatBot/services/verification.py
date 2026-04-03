"""
GigShield — External API Verification Service
Calls weather, air quality, traffic, and news APIs to verify claims.
"""

import asyncio
import logging
import httpx
from config import get_settings
from dataclasses import dataclass

logger = logging.getLogger("gigshield.verification")
settings = get_settings()


@dataclass
class VerificationResult:
    """Results from all external API verifications."""
    precipitation: float = 0.0
    aqi: int = 50
    traffic_speed: float = 40.0
    news_count: int = 0
    api_error: bool = False


async def verify_weather(client: httpx.AsyncClient, lat: float, lon: float) -> float:
    """Get current precipitation from Open-Meteo."""
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=precipitation"
    try:
        response = await client.get(url, timeout=10.0)
        response.raise_for_status()
        return response.json().get("current", {}).get("precipitation", 0.0)
    except Exception as e:
        logger.warning(f"Weather API failed: {e}")
        raise


async def verify_air_quality(client: httpx.AsyncClient, lat: float, lon: float) -> int:
    """Get AQI reading from WAQI."""
    url = f"https://api.waqi.info/feed/geo:{lat};{lon}/?token={settings.WAQI_TOKEN}"
    try:
        response = await client.get(url, timeout=10.0)
        response.raise_for_status()
        raw_aqi = response.json().get("data", {}).get("aqi", 50)
        # WAQI API can return non-numeric values (e.g. "-") when data is unavailable
        try:
            return int(raw_aqi)
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric AQI received: {raw_aqi}, defaulting to 0")
            return 0
    except Exception as e:
        logger.warning(f"Air quality API failed: {e}")
        raise


async def verify_traffic(client: httpx.AsyncClient, lat: float, lon: float) -> float:
    """Get current traffic speed from TomTom."""
    url = (
        f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
        f"?point={lat}%2C{lon}&key={settings.TOMTOM_API_KEY}"
    )
    try:
        response = await client.get(url, timeout=10.0)
        response.raise_for_status()
        return response.json().get("flowSegmentData", {}).get("currentSpeed", 40.0)
    except Exception as e:
        logger.warning(f"Traffic API failed: {e}")
        raise


async def verify_news(client: httpx.AsyncClient) -> int:
    """Get count of recent strike/protest news from NewsAPI."""
    url = (
        f"https://newsapi.org/v2/everything"
        f"?q=strike OR protest OR riot india&language=en"
        f"&sortBy=publishedAt&apiKey={settings.NEWS_API_KEY}"
    )
    try:
        response = await client.get(url, timeout=10.0)
        response.raise_for_status()
        return response.json().get("totalResults", 0)
    except Exception as e:
        logger.warning(f"News API failed: {e}")
        raise


async def verify_all(lat: float, lon: float) -> VerificationResult:
    """Run all verifications in parallel. Returns results or marks api_error."""
    try:
        async with httpx.AsyncClient() as client:
            results = await asyncio.gather(
                verify_weather(client, lat, lon),
                verify_air_quality(client, lat, lon),
                verify_traffic(client, lat, lon),
                verify_news(client),
            )
        return VerificationResult(
            precipitation=results[0],
            aqi=results[1],
            traffic_speed=results[2],
            news_count=results[3],
        )
    except Exception as e:
        logger.error(f"External API verification failed: {e}")
        return VerificationResult(api_error=True)
