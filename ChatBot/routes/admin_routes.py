"""
GigShield — Admin Routes
Platform control and rider management endpoints.

DB Integration:
  • riders_col          → RiderProfile  (ban state, ban_history)
  • transactions_col    → TransactionLog  (zero-touch payout ledger)
  • admin_metrics_col   → AdminDashboardMetrics  (banned list, payouts)
  • app_state_col       → Platform status toggle
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from models import RevokeRequest, BanType, TransactionType, TransactionLog
from auth import verify_admin
from database import riders_col, transactions_col, admin_metrics_col, app_state_col
from config import get_settings

logger = logging.getLogger("gigshield.admin")
settings = get_settings()

router = APIRouter(prefix="/admin", tags=["Admin"])


async def get_platform_status() -> bool:
    """Read PLATFORM_DOWN state from the database."""
    state = await app_state_col.find_one({"key": "platform_status"})
    if state:
        return state.get("is_down", False)
    return False


async def set_platform_status(is_down: bool):
    """Write PLATFORM_DOWN state to the database."""
    await app_state_col.update_one(
        {"key": "platform_status"},
        {"$set": {"is_down": is_down}},
        upsert=True,
    )


@router.post("/toggle-crash")
async def toggle_crash(admin_user=Depends(verify_admin)):
    """Toggle the platform outage simulation state."""
    current_status = await get_platform_status()
    new_status = not current_status
    await set_platform_status(new_status)
    return {"platform_down": new_status}


# =====================================================================
# Issue Ban
# =====================================================================

class IssueBanRequest(BaseModel):
    rider_id: str
    ban_type: str = "temporary"  # "temporary" or "permanent"
    reason: str = "Admin-issued ban."


@router.post("/issue-ban")
async def issue_ban(req: IssueBanRequest, admin_user=Depends(verify_admin)):
    """
    Issue a temporary or permanent ban on a rider.

    DB Actions:
      • riders_col: update current_ban_status, increment ban count via
        $push of a BanRecord into ban_history.
      • admin_metrics_col: $addToSet rider_id to banned_rider_ids.
    """
    rider = await riders_col.find_one({"rider_id": req.rider_id})
    if not rider:
        raise HTTPException(status_code=404, detail=f"Rider '{req.rider_id}' not found.")

    ban_status = rider.get("current_ban_status", BanType.NONE.value)
    if ban_status != BanType.NONE.value:
        return {"message": f"ℹ️ Rider '{req.rider_id}' is already banned ({ban_status})."}

    # Resolve ban type enum
    ban_type_value = (
        BanType.PERMANENT.value
        if req.ban_type.lower() == "permanent"
        else BanType.TEMPORARY.value
    )

    now = datetime.now(timezone.utc)

    ban_record = {
        "ban_type": ban_type_value,
        "issued_at": now,
        "reason": req.reason,
    }

    # ── Update rider: set ban status + append BanRecord ─────────────
    await riders_col.update_one(
        {"rider_id": req.rider_id},
        {
            "$set": {
                "current_ban_status": ban_type_value,
                "updated_at": now,
            },
            "$push": {"ban_history": ban_record},
        },
    )

    # ── Admin metrics: add to banned list ───────────────────────────
    await admin_metrics_col.update_one(
        {},
        {
            "$addToSet": {"banned_rider_ids": req.rider_id},
            "$set": {"last_updated": now},
        },
    )

    logger.info(f"Ban issued: {req.rider_id} → {ban_type_value} | Reason: {req.reason}")

    return {
        "message": f"🚫 {ban_type_value.capitalize()} ban issued for {req.rider_id}.",
        "ban_type": ban_type_value,
        "reason": req.reason,
    }


# =====================================================================
# Revoke Ban (Unban)
# =====================================================================

@router.post("/revoke-suspension")
async def revoke_suspension(req: RevokeRequest, admin_user=Depends(verify_admin)):
    """
    Lift a ban for a rider by ID.

    DB Actions:
      • riders_col: set current_ban_status → "none", update the *last*
        entry in ban_history to mark is_lifted=True with an unban_reason.
      • admin_metrics_col: $pull rider_id from banned_rider_ids.
    """
    rider = await riders_col.find_one({"rider_id": req.rider_id})
    if not rider:
        raise HTTPException(status_code=404, detail=f"Rider '{req.rider_id}' not found.")

    ban_status = rider.get("current_ban_status", BanType.NONE.value)
    if ban_status == BanType.NONE.value:
        return {"message": f"ℹ️ Rider '{req.rider_id}' is not currently banned."}

    now = datetime.now(timezone.utc)
    ban_history = rider.get("ban_history", [])

    # ── Build update operations ─────────────────────────────────────
    update_ops: dict = {
        "$set": {
            "current_ban_status": BanType.NONE.value,
            "updated_at": now,
        },
    }

    # If there is ban_history, mark the *last* record as lifted
    if ban_history:
        last_index = len(ban_history) - 1
        update_ops["$set"][f"ban_history.{last_index}.is_lifted"] = True
        update_ops["$set"][f"ban_history.{last_index}.lifted_at"] = now
        update_ops["$set"][f"ban_history.{last_index}.unban_reason"] = (
            "Admin revoked suspension."
        )

    await riders_col.update_one({"rider_id": req.rider_id}, update_ops)

    # ── Admin metrics: remove from banned list ──────────────────────
    await admin_metrics_col.update_one(
        {},
        {
            "$pull": {"banned_rider_ids": req.rider_id},
            "$set": {"last_updated": now},
        },
    )

    logger.info(f"Ban revoked: {req.rider_id}")

    return {"message": f"✅ Ban revoked for {req.rider_id}."}


# =====================================================================
# Actuarial Constants (40% company margin) — shared with claims_routes
# =====================================================================
TARGET_LOSS_RATIO = 0.60
SAFETY_MARGIN = 0.15
PROBABILITIES = {"traffic": 0.05, "rain": 0.10, "aqi": 0.15}

_POLICY_PROB_KEY = {
    "traffic_gridlock": "traffic",
    "heavy_rain": "rain",
    "severe_pollution": "aqi",
    "comprehensive": "aqi",
}


# =====================================================================
# Zero-Touch Parametric Payouts
# =====================================================================

@router.post("/simulate-zero-touch-payouts")
async def simulate_zero_touch_payouts(admin_user=Depends(verify_admin)):
    """
    Scan live weather/AQI for Delhi and auto-credit every active rider
    if parametric thresholds are breached.

    Payout per rider uses the actuarial formula:
      payout = (premium_paid × TARGET_LOSS_RATIO) / (event_prob × (1 + SAFETY_MARGIN))
    """
    # Default demo location — Delhi
    lat, lon = 28.53, 77.39

    # --- Fetch live environmental data ---
    async with httpx.AsyncClient(timeout=15.0) as http_client:
        try:
            weather_resp = await http_client.get(
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={lat}&longitude={lon}&current=precipitation"
            )
            weather_resp.raise_for_status()
            precipitation = weather_resp.json().get("current", {}).get("precipitation", 0.0)
        except Exception as e:
            logger.error(f"Weather API error during zero-touch scan: {e}")
            precipitation = 0.0

        try:
            aqi_resp = await http_client.get(
                f"https://api.waqi.info/feed/geo:{lat};{lon}/?token={settings.WAQI_TOKEN}"
            )
            aqi_resp.raise_for_status()
            raw_aqi = aqi_resp.json().get("data", {}).get("aqi", 50)
            try:
                aqi = int(raw_aqi)
            except (ValueError, TypeError):
                logger.warning(f"Non-numeric AQI received: {raw_aqi}, defaulting to 0")
                aqi = 0
        except Exception as e:
            logger.error(f"AQI API error during zero-touch scan: {e}")
            aqi = 0

    # --- Determine if a parametric trigger is breached ---
    trigger_breached = False
    reason = ""

    if isinstance(aqi, int) and aqi > 300:
        trigger_breached = True
        reason = f"Severe AQI detected: {aqi} (threshold > 300)"
    elif isinstance(precipitation, (int, float)) and precipitation > 5.0:
        trigger_breached = True
        reason = f"Heavy rainfall detected: {precipitation}mm (threshold > 5.0mm)"

    if not trigger_breached:
        return {
            "message": "No parametric triggers breached.",
            "aqi": aqi,
            "precipitation_mm": precipitation,
            "total_payouts": 0,
            "reason": "All conditions within safe limits.",
        }

    # --- Fetch all active (non-banned) riders with an active policy ---
    active_riders = await riders_col.find(
        {
            "current_ban_status": BanType.NONE.value,
            "role": "rider",
            "has_active_policy": True,
        }
    ).to_list(length=None)

    if not active_riders:
        return {
            "message": "No active riders with policies found.",
            "total_payouts": 0,
            "reason": reason,
        }

    now = datetime.now(timezone.utc)

    # --- Compute actuarial payout per rider + update wallets ---
    update_tasks = []
    tx_docs = []
    total = 0.0
    for r in active_riders:
        policy_type = r.get("active_policy_type", "comprehensive")
        premium_paid = r.get("premium_paid", 0)
        prob_key = _POLICY_PROB_KEY.get(policy_type, "aqi")
        event_prob = PROBABILITIES.get(prob_key, 0.10)

        # Guard against zero-division (e.g. legacy riders with no premium)
        if premium_paid <= 0 or event_prob <= 0:
            rider_payout = 0.0
        else:
            rider_payout = round(
                (premium_paid * TARGET_LOSS_RATIO) / (event_prob * (1 + SAFETY_MARGIN)),
                2,
            )
        total += rider_payout

        update_tasks.append(
            riders_col.update_one(
                {"rider_id": r["rider_id"]},
                {
                    "$inc": {"balance": rider_payout},
                    "$set": {"updated_at": now},
                },
            )
        )
        tx = TransactionLog(
            rider_id=r["rider_id"],
            amount=rider_payout,
            tx_type=TransactionType.CLAIM_PAYOUT,
            description=(
                f"Zero-touch actuarial payout: (₹{premium_paid} × {TARGET_LOSS_RATIO}) "
                f"/ ({event_prob} × {1 + SAFETY_MARGIN}) = ₹{rider_payout}. {reason}"
            ),
            timestamp=now,
        )
        tx_docs.append(tx.model_dump())

    await asyncio.gather(*update_tasks)

    # Bulk insert all transaction records
    if tx_docs:
        await transactions_col.insert_many(tx_docs)

    total = round(total, 2)

    # ── Admin metrics: $inc total_payouts ───────────────────────────
    await admin_metrics_col.update_one(
        {},
        {
            "$inc": {"total_payouts": total},
            "$set": {"last_updated": now},
        },
    )

    logger.info(
        f"Zero-touch actuarial payout: {len(active_riders)} riders, total ₹{total} | {reason}"
    )

    return {
        "message": f"✅ Auto-payout complete.",
        "riders_credited": len(active_riders),
        "total_payouts": total,
        "reason": reason,
        "aqi": aqi,
        "precipitation_mm": precipitation,
    }


# =====================================================================
# Registered Riders Data Sheet
# =====================================================================

@router.get("/riders")
async def get_all_riders(admin_user=Depends(verify_admin)):
    """
    Return a sanitised list of every registered rider for the admin
    data-sheet view.  Password hashes and internal Mongo IDs are
    **never** returned.

    Projection keeps the response lean — only the columns the
    front-end table actually needs.
    """
    projection = {
        "_id": 0,
        "password_hash": 0,
        "ban_history": 0,
        "otp": 0,
        "otp_expiry": 0,
    }

    cursor = riders_col.find(
        {"role": {"$ne": "admin"}},
        projection,
    )
    riders = await cursor.to_list(length=None)

    # Build a clean response with only the required fields
    result = []
    for r in riders:
        result.append({
            "rider_id": r.get("rider_id", "—"),
            "name": r.get("name", "—"),
            "city": r.get("city", "—"),
            "active_delivery_days": r.get("active_delivery_days", 0),
            "balance": r.get("balance", 0),
            "has_active_policy": r.get("has_active_policy", False),
            "current_ban_status": r.get("current_ban_status", "none"),
        })

    logger.info(f"Rider data sheet served — {len(result)} riders returned.")
    return result
