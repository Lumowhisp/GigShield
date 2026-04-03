"""
GigShield — Claims Routes
Core claim filing, policy purchase, ML premium pricing, and verification logic.

DB Integration:
  • riders_col          → RiderProfile  (balance, policy, ban state)
  • transactions_col    → TransactionLog  (premium / payout / penalty ledger)
  • admin_metrics_col   → AdminDashboardMetrics  (aggregated KPIs)
"""

import os
import uuid
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
import httpx

from auth import get_current_rider
from database import riders_col, transactions_col, admin_metrics_col
from services.verification import verify_all
from routes.admin_routes import get_platform_status
from models import (
    BanType, TransactionType, TransactionLog, PolicyType,
    PremiumRequest, PremiumPlan, PremiumResponse,
)

logger = logging.getLogger("gigshield.claims")

router = APIRouter(prefix="/claims", tags=["Claims"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

# =====================================================================
# Actuarial Constants (40% company margin)
# =====================================================================
TARGET_LOSS_RATIO = 0.60
SAFETY_MARGIN = 0.15
PROBABILITIES = {"traffic": 0.05, "rain": 0.10, "aqi": 0.15}

# Map PolicyType enum values → probability keys
_POLICY_PROB_KEY = {
    "traffic_gridlock": "traffic",
    "heavy_rain": "rain",
    "severe_pollution": "aqi",
    "comprehensive": "aqi",  # fallback for multi-peril
}


@router.post("/file")
async def file_claim(
    latitude: float = Form(...),
    longitude: float = Form(...),
    incident_type: str = Form(...),
    custom_reason: str = Form(""),
    image_proof: UploadFile = File(...),
    rider_id: str = Depends(get_current_rider),
):
    """
    File a new claim with GPS location, incident type, and photo proof.
    The image is uploaded server-side and the claim is verified against external APIs.
    """
    # Check rider status
    rider = await riders_col.find_one({"rider_id": rider_id})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found.")

    # --- Policy gate: reject if no active policy or policy expired ---
    policy_active = rider.get("has_active_policy", False)
    policy_expiry = rider.get("policy_expiry")

    if policy_active and policy_expiry:
        try:
            # Handle both datetime objects and ISO strings (legacy)
            if isinstance(policy_expiry, str):
                expiry_dt = datetime.fromisoformat(policy_expiry)
            else:
                expiry_dt = policy_expiry

            if expiry_dt < datetime.now(timezone.utc):
                # Auto-deactivate expired policy + decrement admin counter
                await riders_col.update_one(
                    {"rider_id": rider_id},
                    {
                        "$set": {
                            "has_active_policy": False,
                            "active_policy_type": None,
                            "policy_expiry": None,
                            "updated_at": datetime.now(timezone.utc),
                        },
                    },
                )
                await admin_metrics_col.update_one(
                    {},
                    {
                        "$inc": {"total_active_policies": -1},
                        "$set": {"last_updated": datetime.now(timezone.utc)},
                    },
                )
                policy_active = False
        except (ValueError, TypeError):
            policy_active = False

    if not policy_active:
        raise HTTPException(
            status_code=403,
            detail="No active policy. Please purchase a weekly plan before filing a claim.",
        )

    # Check ban status
    ban_status = rider.get("current_ban_status", BanType.NONE.value)
    if ban_status != BanType.NONE.value:
        return {
            "claim_status": "ACCOUNT SUSPENDED 🚫",
            "system_message": "Your account is currently banned.",
            "new_balance": rider["balance"],
        }

    # Save uploaded image
    file_ext = os.path.splitext(image_proof.filename)[1] if image_proof.filename else ".jpg"
    file_name = f"{rider_id}_{uuid.uuid4().hex[:8]}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    contents = await image_proof.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    logger.info(f"Image proof saved: {file_name} ({len(contents)} bytes)")

    # Handle custom "other" incidents
    incident = incident_type.lower()
    if incident == "other":
        return {
            "claim_status": "MANUAL REVIEW ⏳",
            "system_message": f"Custom Issue: '{custom_reason}'. Sent to Admin for verification.",
            "new_balance": rider["balance"],
        }

    # Verify against external APIs
    data = await verify_all(latitude, longitude)

    if data.api_error:
        return {
            "claim_status": "MANUAL REVIEW ⏳",
            "system_message": "External API timeout. Your claim has been queued for manual review.",
        }

    # Decision engine
    is_approved = False
    reason = "Data does not match claim."

    platform_down = await get_platform_status()

    if "disruption" in incident and platform_down:
        is_approved, reason = True, "Partner Server DOWN Confirmed."
    elif "strike" in incident and data.news_count > 0:
        is_approved, reason = True, f"News Verified ({data.news_count} live reports)."
    elif "pollution" in incident and data.aqi >= 300:
        is_approved, reason = True, f"Severe AQI Verified: {data.aqi}."
    elif "rain" in incident and data.precipitation >= 5.0:
        is_approved, reason = True, f"Heavy Rain Verified: {data.precipitation}mm/hr."
    elif "traffic" in incident and data.traffic_speed <= 5:
        is_approved, reason = True, f"Gridlock Verified: {data.traffic_speed}km/h."

    now = datetime.now(timezone.utc)

    if is_approved:
        # ── Dynamic Actuarial Payout Formula ────────────────────────
        policy_type = rider.get("active_policy_type", "comprehensive")
        premium_paid = rider.get("premium_paid", 0)
        prob_key = _POLICY_PROB_KEY.get(policy_type, "aqi")
        event_prob = PROBABILITIES.get(prob_key, 0.10)

        # Guard against zero-division (e.g. legacy riders with no premium)
        if premium_paid <= 0 or event_prob <= 0:
            calculated_payout = 0.0
        else:
            calculated_payout = round(
                (premium_paid * TARGET_LOSS_RATIO) / (event_prob * (1 + SAFETY_MARGIN)),
                2,
            )

        # ── Increment rider balance ─────────────────────────────────
        updated = await riders_col.find_one_and_update(
            {"rider_id": rider_id},
            {
                "$inc": {"balance": calculated_payout},
                "$set": {"updated_at": now},
            },
            return_document=True,
        )

        # ── Ledger: record claim_payout in transactions_col ─────────
        payout_tx = TransactionLog(
            rider_id=rider_id,
            amount=calculated_payout,
            tx_type=TransactionType.CLAIM_PAYOUT,
            description=(
                f"Actuarial payout: (₹{premium_paid} × {TARGET_LOSS_RATIO}) "
                f"/ ({event_prob} × {1 + SAFETY_MARGIN}) = ₹{calculated_payout}. {reason}"
            ),
            timestamp=now,
        )
        await transactions_col.insert_one(payout_tx.model_dump())

        # ── Admin metrics: $inc total_payouts ───────────────────────
        await admin_metrics_col.update_one(
            {},
            {
                "$inc": {"total_payouts": calculated_payout},
                "$set": {"last_updated": now},
            },
        )

        return {
            "claim_status": "AUTO-APPROVED ✅",
            "system_message": (
                f"Payout: ₹{calculated_payout} "
                f"[formula: (₹{premium_paid} × {TARGET_LOSS_RATIO}) / ({event_prob} × {1 + SAFETY_MARGIN})]. "
                f"{reason}"
            ),
            "new_balance": updated["balance"],
        }
    else:
        # Fraud detection — use ban_history length for strike tracking
        strike_count = len(rider.get("ban_history", [])) + 1
        fine = 0
        if strike_count >= 10:
            fine = 120
        elif strike_count == 7:
            fine = 80
        elif strike_count == 5:
            fine = 50

        # Determine if this triggers a permanent ban
        should_perm_ban = strike_count >= 10
        new_ban_status = (
            BanType.PERMANENT.value if should_perm_ban else BanType.NONE.value
        )

        ban_record = {
            "ban_type": BanType.PERMANENT.value if should_perm_ban else BanType.TEMPORARY.value,
            "issued_at": now,
            "reason": f"Fraud strike {strike_count}: claim data does not match conditions.",
        }

        update_ops = {
            "$inc": {
                "balance": -fine,
            },
            "$set": {
                "current_ban_status": new_ban_status,
                "updated_at": now,
            },
            "$push": {"ban_history": ban_record},
        }

        # If permanently banned, update admin metrics — add to banned list
        if should_perm_ban:
            await admin_metrics_col.update_one(
                {},
                {
                    "$addToSet": {"banned_rider_ids": rider_id},
                    "$set": {"last_updated": now},
                },
            )

        updated = await riders_col.find_one_and_update(
            {"rider_id": rider_id},
            update_ops,
            return_document=True,
        )

        # ── Ledger: record penalty in transactions_col ──────────────
        if fine > 0:
            penalty_tx = TransactionLog(
                rider_id=rider_id,
                amount=-fine,
                tx_type=TransactionType.PENALTY_DEDUCTED,
                description=f"Fraud strike {strike_count}. Wallet penalty: ₹{fine}.",
                timestamp=now,
            )
            await transactions_col.insert_one(penalty_tx.model_dump())

        status_msg = "ACCOUNT BANNED \U0001f6ab" if should_perm_ban else "FRAUD DETECTED \u26a0\ufe0f"
        return {
            "claim_status": status_msg,
            "system_message": f"Strike {strike_count}. Wallet Penalty: ₹{fine}",
            "new_balance": updated["balance"],
        }


# =====================================================================
# Policy Purchase
# =====================================================================

class BuyPolicyRequest(BaseModel):
    city: str
    premium_amount: float | None = None    # ML-engine dynamic price
    policy_type: str | None = None         # ML-engine policy type


@router.post("/buy-policy")
async def buy_policy(
    req: BuyPolicyRequest,
    rider_id: str = Depends(get_current_rider),
):
    """
    Purchase a 7-day parametric insurance policy.
    When `premium_amount` and `policy_type` are provided (from the ML
    pricing engine), those values are used directly.  Otherwise the
    legacy city-based pricing is applied as a fallback.
    """
    rider = await riders_col.find_one({"rider_id": rider_id})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found.")

    # --- Underwriting gate: minimum 5 active delivery days ---
    if rider.get("active_delivery_days", 0) < 5:
        raise HTTPException(
            status_code=400,
            detail="Underwriting Rejected: Minimum 5 active delivery days required before cover starts.",
        )

    # --- Use ML-engine pricing if provided, else fallback to city-based ---
    if req.premium_amount is not None and req.policy_type is not None:
        premium = req.premium_amount
        policy_type = req.policy_type
    else:
        city = req.city.strip().lower()
        if city in ("delhi", "noida", "gurugram"):
            premium = 45
            policy_type = PolicyType.COMPREHENSIVE.value
        elif city in ("mumbai", "chennai"):
            premium = 40
            policy_type = PolicyType.HEAVY_RAIN.value
        else:
            premium = 30
            policy_type = PolicyType.COMPREHENSIVE.value

    if rider.get("balance", 0) < premium:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Need ₹{premium}, have ₹{rider['balance']}.",
        )

    now = datetime.now(timezone.utc)
    expiry = now + timedelta(days=7)

    # ── Deduct premium from rider balance, activate policy ──────────
    updated = await riders_col.find_one_and_update(
        {"rider_id": rider_id},
        {
            "$inc": {"balance": -premium},
            "$set": {
                "has_active_policy": True,
                "active_policy_type": policy_type,
                "premium_paid": premium,
                "policy_expiry": expiry,
                "updated_at": now,
            },
        },
        return_document=True,
    )

    # ── Ledger: record premium_paid in transactions_col ─────────────
    premium_tx = TransactionLog(
        rider_id=rider_id,
        amount=-premium,
        tx_type=TransactionType.PREMIUM_PAID,
        description=f"Weekly {policy_type} policy purchased for {req.city}.",
        timestamp=now,
    )
    await transactions_col.insert_one(premium_tx.model_dump())

    # ── Admin metrics: $inc policy count + income ───────────────────
    await admin_metrics_col.update_one(
        {},
        {
            "$inc": {
                "total_active_policies": 1,
                "total_income": premium,
            },
            "$set": {"last_updated": now},
        },
    )

    return {
        "message": f"✅ Weekly policy activated! ₹{premium} deducted.",
        "policy_type": policy_type,
        "policy_expiry": expiry.isoformat(),
        "new_balance": updated["balance"],
    }


# =====================================================================
# Policy Status
# =====================================================================

@router.get("/policy-status")
async def get_policy_status(
    rider_id: str = Depends(get_current_rider),
):
    """Return the rider's current policy status."""
    rider = await riders_col.find_one({"rider_id": rider_id})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found.")

    policy_active = rider.get("has_active_policy", False)
    policy_expiry = rider.get("policy_expiry")
    policy_type = rider.get("active_policy_type")

    # Check if policy has expired
    if policy_active and policy_expiry:
        try:
            if isinstance(policy_expiry, str):
                expiry_dt = datetime.fromisoformat(policy_expiry)
            else:
                expiry_dt = policy_expiry

            if expiry_dt < datetime.now(timezone.utc):
                now = datetime.now(timezone.utc)
                await riders_col.update_one(
                    {"rider_id": rider_id},
                    {
                        "$set": {
                            "has_active_policy": False,
                            "active_policy_type": None,
                            "policy_expiry": None,
                            "updated_at": now,
                        },
                    },
                )
                # Decrement active policy count in admin metrics
                await admin_metrics_col.update_one(
                    {},
                    {
                        "$inc": {"total_active_policies": -1},
                        "$set": {"last_updated": now},
                    },
                )
                policy_active = False
                policy_type = None
                policy_expiry = None
        except (ValueError, TypeError):
            policy_active = False
            policy_type = None
            policy_expiry = None

    # Serialize expiry for JSON response
    expiry_str = None
    if policy_expiry:
        expiry_str = (
            policy_expiry.isoformat()
            if isinstance(policy_expiry, datetime)
            else policy_expiry
        )

    return {
        "policy_active": policy_active,
        "policy_type": policy_type,
        "policy_expiry": expiry_str,
        "balance": rider.get("balance", 0),
    }


# =====================================================================
# Wallet Top-Up (Demo Gateway)
# =====================================================================

class AddFundsRequest(BaseModel):
    amount: float


@router.post("/add-funds")
async def add_funds(
    req: AddFundsRequest,
    rider_id: str = Depends(get_current_rider),
):
    """
    Add funds to the rider's wallet (demo mode).
    In production, this would be behind a Razorpay/UPI payment gateway.
    """
    if req.amount <= 0 or req.amount > 5000:
        raise HTTPException(status_code=400, detail="Amount must be between ₹1 and ₹5000.")

    now = datetime.now(timezone.utc)

    updated = await riders_col.find_one_and_update(
        {"rider_id": rider_id},
        {
            "$inc": {"balance": req.amount},
            "$set": {"updated_at": now},
        },
        return_document=True,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Rider not found.")

    # Ledger entry
    fund_tx = TransactionLog(
        rider_id=rider_id,
        amount=req.amount,
        tx_type=TransactionType.PREMIUM_PAID,
        description=f"Wallet top-up ₹{req.amount} (demo gateway).",
        timestamp=now,
    )
    await transactions_col.insert_one(fund_tx.model_dump())

    return {
        "message": f"💰 ₹{req.amount} added successfully!",
        "new_balance": updated["balance"],
    }


# =====================================================================
# ML Engine Premium Hook — Dynamic Pricing (TASK 3)
# =====================================================================

async def _fetch_14day_forecast(lat: float, lon: float) -> dict:
    """
    Fetch 14-day weather forecast from Open-Meteo for risk assessment.
    Returns aggregated risk metrics.
    """
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&daily=precipitation_sum,temperature_2m_max,temperature_2m_min"
        f"&forecast_days=14&timezone=auto"
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        daily = data.get("daily", {})
        precip_list = daily.get("precipitation_sum", [])
        temp_max_list = daily.get("temperature_2m_max", [])

        total_precip = sum(p for p in precip_list if p is not None)
        max_temp = max((t for t in temp_max_list if t is not None), default=35.0)
        heavy_rain_days = sum(1 for p in precip_list if p and p > 10.0)

        return {
            "total_precip_mm": round(total_precip, 1),
            "max_temp_c": round(max_temp, 1),
            "heavy_rain_days": heavy_rain_days,
            "forecast_available": True,
        }
    except Exception as e:
        logger.warning(f"14-day forecast fetch failed: {e}")
        return {
            "total_precip_mm": 0.0,
            "max_temp_c": 35.0,
            "heavy_rain_days": 0,
            "forecast_available": False,
        }


def _compute_forecast_risk(forecast: dict) -> tuple[float, list[str]]:
    """
    Compute a risk score (0.0–1.0) from the 14-day forecast data.
    Returns (risk_score, list_of_risk_factors).
    """
    risk = 0.0
    factors = []

    total_precip = forecast.get("total_precip_mm", 0.0)
    max_temp = forecast.get("max_temp_c", 35.0)
    heavy_rain_days = forecast.get("heavy_rain_days", 0)

    # Precipitation risk
    if total_precip > 200:
        risk += 0.40
        factors.append(f"Extreme rainfall forecast: {total_precip}mm over 14 days")
    elif total_precip > 100:
        risk += 0.25
        factors.append(f"Heavy rainfall forecast: {total_precip}mm over 14 days")
    elif total_precip > 50:
        risk += 0.10
        factors.append(f"Moderate rainfall forecast: {total_precip}mm over 14 days")

    # Consecutive heavy rain days
    if heavy_rain_days >= 7:
        risk += 0.30
        factors.append(f"Flood risk: {heavy_rain_days} days with >10mm rain")
    elif heavy_rain_days >= 4:
        risk += 0.15
        factors.append(f"Sustained rain: {heavy_rain_days} heavy rain days")

    # Extreme temperature
    if max_temp > 48:
        risk += 0.20
        factors.append(f"Extreme heat: {max_temp}°C forecast")
    elif max_temp > 44:
        risk += 0.10
        factors.append(f"Severe heat: {max_temp}°C forecast")

    if not factors:
        factors.append("Normal weather conditions forecast")

    return min(risk, 1.0), factors


@router.post("/premium", response_model=PremiumResponse)
async def get_dynamic_premium(req: PremiumRequest):
    """
    ML Engine Premium Hook — Dynamic Risk-Based Pricing.

    Fetches a 14-day weather forecast for the rider's location,
    computes a forecast risk score, and generates dynamic premium plans.
    If extreme risk is detected (score > 0.85), underwriting is suspended.

    The actuarial payout formula is PRESERVED — the dynamic premium
    feeds into: (premium_paid × 0.60) / (event_prob × 1.15)
    """
    # --- Step 1: Fetch 14-day forecast ---
    forecast = await _fetch_14day_forecast(req.latitude, req.longitude)

    # --- Step 2: Compute risk score ---
    forecast_risk, risk_factors = _compute_forecast_risk(forecast)

    # --- Step 3: Check for suspension (extreme risk) ---
    is_suspended = forecast_risk > 0.85

    if is_suspended:
        return PremiumResponse(
            is_suspended=True,
            forecast_risk=round(forecast_risk, 3),
            plans=[],
            risk_factors=risk_factors + [
                "\u26a0\ufe0f Underwriting SUSPENDED: Extreme 14-day weather forecast. Policy purchases blocked."
            ],
        )

    # --- Step 4: Generate dynamic premium plans ---
    # Risk multiplier: higher risk = higher premium (1.0x to 2.0x)
    risk_multiplier = 1.0 + (forecast_risk * 1.0)

    # Base premiums by city tier
    city_lower = req.city.strip().lower()
    if city_lower in ("delhi", "noida", "gurugram"):
        base_premium = 45.0
    elif city_lower in ("mumbai", "chennai"):
        base_premium = 40.0
    else:
        base_premium = 30.0

    # Income adjustment: riders earning more pay slightly more (capped at 1.3x)
    income_factor = min(1.0 + (req.daily_income / 3000.0) * 0.3, 1.3) if req.daily_income > 0 else 1.0

    plans = [
        PremiumPlan(
            plan_name="Basic",
            premium_amount=round(base_premium * 0.7 * risk_multiplier * income_factor, 2),
            policy_type=PolicyType.HEAVY_RAIN.value,
            coverage_details="Rain-only coverage: Payouts for heavy rainfall incidents (>5mm/hr)",
        ),
        PremiumPlan(
            plan_name="Standard",
            premium_amount=round(base_premium * risk_multiplier * income_factor, 2),
            policy_type=PolicyType.SEVERE_POLLUTION.value,
            coverage_details="Rain + Pollution coverage: Payouts for rain and AQI > 300 incidents",
        ),
        PremiumPlan(
            plan_name="Premium",
            premium_amount=round(base_premium * 1.4 * risk_multiplier * income_factor, 2),
            policy_type=PolicyType.COMPREHENSIVE.value,
            coverage_details="Full coverage: Rain, pollution, traffic gridlock, strikes, and platform outages",
        ),
    ]

    return PremiumResponse(
        is_suspended=False,
        forecast_risk=round(forecast_risk, 3),
        plans=plans,
        risk_factors=risk_factors,
    )
