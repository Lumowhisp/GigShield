"""
GigShield — Centralized Configuration
Loads all settings from .env via pydantic-settings.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # --- MongoDB ---
    MONGO_URL: str
    MONGO_DB_NAME: str = "gigshield_final"

    # --- JWT ---
    SECRET_KEY: str
    ALGORITHM: str = "HS256"

    # --- External API Keys ---
    WAQI_TOKEN: str
    TOMTOM_API_KEY: str
    NEWS_API_KEY: str

    # --- CORS ---
    CORS_ORIGINS: str = "*"

    # --- Seed Users ---
    SEED_RIDER_ID: str = "Rider_007"
    SEED_RIDER_NAME: str = "Abhishek Singh"
    SEED_RIDER_EMAIL: str = "rider@gigshield.com"
    SEED_RIDER_PASSWORD: str = "password123"
    SEED_ADMIN_NAME: str = "Administrator Aaryan"
    SEED_ADMIN_EMAIL: str = "admin@gigshield.com"
    SEED_ADMIN_PASSWORD: str = "24680"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance — loaded once from .env."""
    return Settings()
