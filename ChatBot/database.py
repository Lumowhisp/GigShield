"""
GigShield — Database Module
MongoDB connection via Motor (async driver).

Collection ↔ Model Mapping
----------------------------
  • riders_col         → RiderProfile
  • transactions_col   → TransactionLog
  • admin_metrics_col  → AdminDashboardMetrics
  • app_state_col      → Legacy platform state
"""

from motor.motor_asyncio import AsyncIOMotorClient
import certifi
from config import get_settings

settings = get_settings()

# MongoDB client with TLS certificate verification
client = AsyncIOMotorClient(settings.MONGO_URL, tlsCAFile=certifi.where())
db = client[settings.MONGO_DB_NAME]

# ─── Collections ─────────────────────────────────────────────────────
riders_col = db.riders
transactions_col = db.transactions
admin_metrics_col = db.admin_metrics
app_state_col = db.app_state


async def ensure_indexes():
    """
    Create required indexes on startup for performance and uniqueness.
    Called once during application lifespan startup.
    """
    # riders — fast lookup + uniqueness on rider_id and email
    await riders_col.create_index("rider_id", unique=True)
    await riders_col.create_index("email", unique=True)

    # transactions — uniqueness on tx_id, plus query indexes
    await transactions_col.create_index("tx_id", unique=True)
    await transactions_col.create_index("rider_id")
    await transactions_col.create_index("timestamp")
    await transactions_col.create_index("tx_type")

    # admin_metrics — recency ordering
    await admin_metrics_col.create_index("last_updated")
