"""
GigShield — Auth Routes
Registration, login, Firebase sync, and password-reset endpoints.

DB Integration:
  • riders_col     → RiderProfile documents
  • transactions_col → TransactionLog documents (welcome-bonus ledger entry)
"""

import random
import string
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, EmailStr

from auth import hash_password, verify_password, create_token
from database import riders_col, transactions_col
from models import (
    BanType,
    RegisterRequest,
    LoginRequest,
    RiderProfile,
    TransactionLog,
    TransactionType,
    FirebaseSyncRequest,
)

import logging
logger = logging.getLogger("gigshield.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])


# =====================================================================
#  Request Schemas — Forgot / Reset Password
# =====================================================================

class ForgotPasswordReq(BaseModel):
    """Payload for requesting a password-reset OTP."""
    email: EmailStr


class ResetPasswordReq(BaseModel):
    """Payload for resetting a password using an OTP."""
    email: EmailStr
    otp: str
    new_password: str


# =====================================================================
#  Routes
# =====================================================================

@router.post("/register")
async def register(req: RegisterRequest):
    """Register a new rider with an auto-generated GIG-XXXXX ID."""

    # ── Check email uniqueness ──────────────────────────────────────
    existing = await riders_col.find_one({"email": req.email})
    if existing:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    # ── Generate unique rider ID ────────────────────────────────────
    random_numbers = "".join(random.choices(string.digits, k=5))
    new_rider_id = f"GIG-{random_numbers}"

    while await riders_col.find_one({"rider_id": new_rider_id}):
        random_numbers = "".join(random.choices(string.digits, k=5))
        new_rider_id = f"GIG-{random_numbers}"

    now = datetime.now(timezone.utc)

    # ── Build rider document strictly matching RiderProfile schema ──
    rider_profile = RiderProfile(
        rider_id=new_rider_id,
        name=req.name,
        phone=req.phone,
        email=req.email,
        age=req.age,
        city=req.city,
        avg_daily_income=req.avg_daily_income,
        password=hash_password(req.password),
        # Defaults from model: balance=0.0, has_active_policy=False,
        # active_policy_type=None, policy_expiry=None,
        # current_ban_status=BanType.NONE, ban_history=[],
        # created_at=now, updated_at=now
    )

    # Serialize to a dict suitable for MongoDB insertion.
    # Override timestamps to use our single `now` for consistency.
    rider_doc = rider_profile.model_dump()
    rider_doc["created_at"] = now
    rider_doc["updated_at"] = now
    # Persist the role field for admin/rider distinction (not in Pydantic model
    # but required by auth middleware for role checks)
    rider_doc["role"] = "rider"

    try:
        await riders_col.insert_one(rider_doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    # ── Log welcome-bonus as a TransactionLog entry ─────────────────
    welcome_tx = TransactionLog(
        rider_id=new_rider_id,
        amount=0.0,
        tx_type=TransactionType.PREMIUM_PAID,
        description="Account created — initial wallet balance ₹0.",
        timestamp=now,
    )
    await transactions_col.insert_one(welcome_tx.model_dump())

    return {
        "message": (
            f"✅ Registration successful!\n\n"
            f"Your Rider ID is: {new_rider_id}\n\n"
            f"Please use your email to login."
        )
    }


@router.post("/login")
async def login(req: LoginRequest):
    """Authenticate a rider/admin via email and return a JWT token."""

    # ── Look up by email in riders_col ──────────────────────────────
    rider = await riders_col.find_one({"email": req.email})
    if not rider:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # ── Check ban status — block permanently banned accounts ────────
    ban_status = rider.get("current_ban_status", BanType.NONE.value)
    if ban_status == BanType.PERMANENT.value:
        raise HTTPException(
            status_code=403,
            detail="This account has been permanently banned. Contact support.",
        )

    # ── Password verification (supports legacy plaintext migration) ─
    password_valid = False
    try:
        password_valid = verify_password(req.password, rider["password"])
    except (ValueError, Exception):
        # Fallback: check if password is stored as plaintext (legacy)
        password_valid = req.password == rider["password"]
        if password_valid:
            # Migrate plaintext password to hashed
            hashed = hash_password(req.password)
            await riders_col.update_one(
                {"email": req.email},
                {
                    "$set": {
                        "password": hashed,
                        "updated_at": datetime.now(timezone.utc),
                    },
                },
            )

    if password_valid:
        # Encode rider_id as JWT subject so downstream routes don't break
        token = create_token(rider["rider_id"])
        return {"token": token, "rider_id": rider["rider_id"]}

    raise HTTPException(status_code=401, detail="Invalid email or password.")


# =====================================================================
#  Forgot Password / Reset Password (OTP Flow)
# =====================================================================

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordReq):
    """Generate a 6-digit OTP and store it against the rider's profile."""

    rider = await riders_col.find_one({"email": req.email})
    if not rider:
        raise HTTPException(
            status_code=404,
            detail="No account found with this email address.",
        )

    # Generate a random 6-digit OTP
    otp = "".join(random.choices(string.digits, k=6))
    expiry = datetime.now(timezone.utc) + timedelta(minutes=10)

    await riders_col.update_one(
        {"email": req.email},
        {
            "$set": {
                "reset_otp": otp,
                "otp_expiry": expiry,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    # Hackathon demo: print to terminal instead of sending real email
    print(f"📧 EMAIL SENT TO {req.email}: Your OTP is {otp}")

    return {"message": "OTP has been sent to your registered email address."}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordReq):
    """Verify OTP and reset the rider's password."""

    try:
        rider = await riders_col.find_one({"email": req.email})
        if not rider:
            raise HTTPException(
                status_code=404,
                detail="No account found with this email address.",
            )

        stored_otp = rider.get("reset_otp")
        otp_expiry = rider.get("otp_expiry")

        # Validate OTP exists and hasn't expired
        if not stored_otp or not otp_expiry:
            raise HTTPException(
                status_code=400,
                detail="No OTP was requested for this account.",
            )

        if stored_otp != req.otp:
            raise HTTPException(status_code=400, detail="Invalid OTP.")

        # Normalize otp_expiry to timezone-aware (UTC) if it was stored as naive
        if otp_expiry.tzinfo is None:
            otp_expiry = otp_expiry.replace(tzinfo=timezone.utc)

        now_utc = datetime.now(timezone.utc)

        if otp_expiry < now_utc:
            raise HTTPException(
                status_code=400,
                detail="OTP has expired. Please request a new one.",
            )

        # Hash the new password and clear OTP fields via $unset
        hashed = hash_password(req.new_password)
        await riders_col.update_one(
            {"email": req.email},
            {
                "$set": {
                    "password": hashed,
                    "updated_at": now_utc,
                },
                "$unset": {
                    "reset_otp": "",
                    "otp_expiry": "",
                },
            },
        )

        return {
            "message": "✅ Password has been reset successfully. You can now login with your new password."
        }

    except HTTPException:
        # Re-raise FastAPI HTTP exceptions as-is (they already produce JSON)
        raise
    except Exception as e:
        print(f"❌ reset-password error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================================
#  Firebase Auth Bridge — Mobile App Sync (TASK 2)
# =====================================================================

def _mock_verify_firebase_token(token: str) -> dict:
    """
    Mock Firebase ID token verification.

    TODO (Production): Replace with:
        import firebase_admin
        from firebase_admin import auth as fb_auth
        decoded = fb_auth.verify_id_token(token)
        return decoded  # contains uid, email, name, etc.

    For now, we trust the token and return a synthetic decoded payload.
    """
    # In production this would raise if the token is invalid/expired
    if not token or len(token) < 10:
        raise ValueError("Invalid Firebase token")
    return {"uid": token[:28], "email_verified": True}


@router.post("/firebase-sync")
async def firebase_sync(req: FirebaseSyncRequest):
    """
    Sync a Firebase-authenticated mobile user into the GigShield backend.

    Flow:
      1. Verify the Firebase ID token (mock for now).
      2. Upsert the user into riders_col by email.
      3. Return a standard JWT so all other backend routes work seamlessly.
    """
    # --- Step 1: Verify Firebase token ---
    try:
        decoded = _mock_verify_firebase_token(req.firebase_token)
    except (ValueError, Exception) as e:
        raise HTTPException(
            status_code=401,
            detail=f"Firebase token verification failed: {e}",
        )

    logger.info(f"Firebase sync: {req.email} (uid: {decoded.get('uid', 'N/A')})")

    # --- Step 2: Check if user already exists ---
    existing = await riders_col.find_one({"email": req.email})
    now = datetime.now(timezone.utc)
    is_new_user = False

    if existing:
        # Update existing user's name and timestamp
        await riders_col.update_one(
            {"email": req.email},
            {
                "$set": {
                    "name": req.name,
                    "firebase_uid": decoded.get("uid"),
                    "updated_at": now,
                },
            },
        )
        rider_id = existing["rider_id"]
    else:
        # Create new rider from Firebase data
        is_new_user = True
        random_numbers = "".join(random.choices(string.digits, k=5))
        new_rider_id = f"GIG-{random_numbers}"

        while await riders_col.find_one({"rider_id": new_rider_id}):
            random_numbers = "".join(random.choices(string.digits, k=5))
            new_rider_id = f"GIG-{random_numbers}"

        rider_doc = {
            "rider_id": new_rider_id,
            "name": req.name,
            "email": req.email,
            "phone": "",
            "age": 18,
            "city": "",
            "avg_daily_income": 0.0,
            "password": "",  # Firebase users don't need a local password
            "active_delivery_days": 0,
            "balance": 0.0,
            "has_active_policy": False,
            "active_policy_type": None,
            "premium_paid": 0.0,
            "policy_expiry": None,
            "current_ban_status": BanType.NONE.value,
            "ban_history": [],
            "role": "rider",
            "firebase_uid": decoded.get("uid"),
            "created_at": now,
            "updated_at": now,
        }
        await riders_col.insert_one(rider_doc)
        rider_id = new_rider_id

        # Log welcome transaction
        welcome_tx = TransactionLog(
            rider_id=new_rider_id,
            amount=0.0,
            tx_type=TransactionType.PREMIUM_PAID,
            description="Account created via Firebase sync — initial wallet balance ₹0.",
            timestamp=now,
        )
        await transactions_col.insert_one(welcome_tx.model_dump())

    # --- Step 3: Issue standard JWT ---
    token = create_token(rider_id)

    return {
        "token": token,
        "rider_id": rider_id,
        "is_new_user": is_new_user,
    }

