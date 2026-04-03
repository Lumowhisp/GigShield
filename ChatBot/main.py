"""
GigShield Ultimate — Neural Ninjas
Main application entrypoint.
"""

import os
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings
from database import (
    riders_col,
    transactions_col,
    admin_metrics_col,
    app_state_col,
    ensure_indexes,
)
from auth import hash_password
from models import BanType
from routes.auth_routes import router as auth_router
from routes.admin_routes import router as admin_router
from routes.claims_routes import router as claims_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("gigshield")

settings = get_settings()

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(BASE_DIR, "templates", "index.html")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")


# =====================================================================
# Migration — backfill legacy rider docs with new schema fields
# =====================================================================
async def migrate_legacy_riders():
    """
    Find rider documents missing the new fields and backfill them
    with sensible defaults.  This is idempotent — safe to run on
    every startup.
    """
    now = datetime.now(timezone.utc)

    # Any rider doc missing 'current_ban_status' is legacy
    legacy_cursor = riders_col.find({"current_ban_status": {"$exists": False}})
    migrated = 0

    async for doc in legacy_cursor:
        # Map old fields → new fields
        old_strikes = doc.get("strikes", 0)
        old_penalized = doc.get("is_penalized", False)
        old_policy_active = doc.get("policy_active", False)

        new_fields = {
            # Ban management
            "current_ban_status": (
                BanType.PERMANENT.value if old_penalized else BanType.NONE.value
            ),
            "ban_history": [],
            # Policy state
            "has_active_policy": old_policy_active,
            "active_policy_type": None,
            "premium_paid": 0.0,
            # Profile fields (placeholders for legacy docs)
            "phone": doc.get("phone", ""),
            "email": doc.get("email") or f"{doc.get('rider_id', doc['_id'])}@legacy.gigshield.com",
            "age": doc.get("age", 18),
            "city": doc.get("city", ""),
            "avg_daily_income": doc.get("avg_daily_income", 0.0),
            "active_delivery_days": doc.get("active_delivery_days", 0),
            # Timestamps
            "created_at": doc.get("created_at", now),
            "updated_at": now,
        }

        await riders_col.update_one(
            {"_id": doc["_id"]},
            {"$set": new_fields},
        )
        migrated += 1

    if migrated:
        logger.info(f"🔄 Migrated {migrated} legacy rider doc(s) to new schema.")


# =====================================================================
# Seed — initial admin_metrics document
# =====================================================================
async def seed_admin_metrics():
    """Seed a default admin_metrics document if none exists."""
    existing = await admin_metrics_col.find_one({})
    if not existing:
        now = datetime.now(timezone.utc)
        await admin_metrics_col.insert_one({
            "total_active_policies": 0,
            "total_income": 0.0,
            "total_payouts": 0.0,
            "banned_rider_ids": [],
            "last_updated": now,
        })
        logger.info("📊 Seeded initial admin_metrics document.")


# =====================================================================
# Lifespan — replaces deprecated @app.on_event("startup")
# =====================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create indexes, migrate data, seed default users."""
    logger.info("🚀 GigShield starting up...")

    # Ensure uploads directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Create MongoDB indexes
    await ensure_indexes()
    logger.info("🗂️  Database indexes ensured.")

    now = datetime.now(timezone.utc)

    # Seed default rider — uses new schema fields
    await riders_col.update_one(
        {"rider_id": settings.SEED_RIDER_ID},
        {
            "$set": {
                "name": settings.SEED_RIDER_NAME,
                "email": settings.SEED_RIDER_EMAIL,
                "password": hash_password(settings.SEED_RIDER_PASSWORD),
                "role": "rider",
                "updated_at": now,
            },
            "$setOnInsert": {
                "balance": 500.0,
                "phone": "",
                "age": 18,
                "city": "",
                "avg_daily_income": 0.0,
                "active_delivery_days": 0,
                "premium_paid": 0.0,
                "has_active_policy": False,
                "active_policy_type": None,
                "policy_expiry": None,
                "current_ban_status": BanType.NONE.value,
                "ban_history": [],
                "created_at": now,
            },
        },
        upsert=True,
    )

    # Seed default admin — upsert by email
    # Generate a stable rider_id for the admin so JWT auth works
    admin_rider_id = "ADMIN-00001"
    await riders_col.update_one(
        {"email": settings.SEED_ADMIN_EMAIL},
        {
            "$set": {
                "name": settings.SEED_ADMIN_NAME,
                "email": settings.SEED_ADMIN_EMAIL,
                "password": hash_password(settings.SEED_ADMIN_PASSWORD),
                "role": "admin",
                "rider_id": admin_rider_id,
                "balance": 99999.0,
                "age": 30,
                "city": "Admin HQ",
                "updated_at": now,
            },
            "$setOnInsert": {
                "phone": "",
                "avg_daily_income": 0.0,
                "active_delivery_days": 0,
                "premium_paid": 0.0,
                "has_active_policy": False,
                "active_policy_type": None,
                "policy_expiry": None,
                "current_ban_status": BanType.NONE.value,
                "ban_history": [],
                "created_at": now,
            },
        },
        upsert=True,
    )

    # Initialize platform status in DB
    await app_state_col.update_one(
        {"key": "platform_status"},
        {"$setOnInsert": {"is_down": False}},
        upsert=True,
    )

    # Run migration for existing legacy docs
    await migrate_legacy_riders()

    # Seed admin dashboard metrics
    await seed_admin_metrics()

    logger.info("✅ Database seeded, indexes created, uploads directory ready.")

    yield  # App runs here

    logger.info("👋 GigShield shutting down.")


# =====================================================================
# App Initialization
# =====================================================================
app = FastAPI(
    title="GigShield Ultimate - Neural Ninjas",
    description="Insurance & compensation platform for gig-economy riders",
    version="4.0.0",
    lifespan=lifespan,
)

# CORS — configurable via .env
cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(claims_router)


# =====================================================================
# Frontend
# =====================================================================
ADMIN_TEMPLATE_PATH = os.path.join(BASE_DIR, "templates", "admin.html")
LOGIN_TEMPLATE_PATH = os.path.join(BASE_DIR, "templates", "login.html")


@app.get("/", response_class=FileResponse)
def home():
    """Serve the public rider app."""
    return FileResponse(TEMPLATE_PATH, media_type="text/html")


@app.get("/login", response_class=FileResponse)
def login_page():
    """Serve the public login / onboarding page with Marketing GigBot."""
    return FileResponse(LOGIN_TEMPLATE_PATH, media_type="text/html")


@app.get("/neural-portal", response_class=FileResponse)
def admin_portal():
    """Serve the isolated admin portal (secret route)."""
    return FileResponse(ADMIN_TEMPLATE_PATH, media_type="text/html")


# =====================================================================
# Entrypoint
# =====================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)