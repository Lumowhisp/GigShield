"""
GigShield — Pydantic Models & MongoDB Document Schemas
======================================================

This module defines both the **API request/response schemas** and the
**MongoDB document models** used throughout the GigShield backend.

MongoDB Collection ↔ Model Mapping
------------------------------------
  • `riders`          → RiderProfile
  • `transactions`    → TransactionLog
  • `admin_metrics`   → AdminDashboardMetrics

Design Principles:
  1. Rider data, admin data, and transaction data live in *separate*
     collections — transactions are NEVER nested inside a rider profile.
  2. All datetime fields are timezone-aware (UTC).
  3. Pydantic V2 `BaseModel` + `Field` is used for every schema.
  4. String-based Enums enforce data consistency at the application layer.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


# =====================================================================
#  ENUMS — Strict Typing for Data Consistency
# =====================================================================

class BanType(str, Enum):
    """Classification of account ban severity."""
    TEMPORARY = "temporary"
    PERMANENT = "permanent"
    NONE = "none"


class PolicyType(str, Enum):
    """Available parametric insurance policy categories."""
    HEAVY_RAIN = "heavy_rain"
    SEVERE_POLLUTION = "severe_pollution"
    TRAFFIC_GRIDLOCK = "traffic_gridlock"
    COMPREHENSIVE = "comprehensive"


class TransactionType(str, Enum):
    """Allowed financial transaction categories in the global ledger."""
    PREMIUM_PAID = "premium_paid"
    CLAIM_PAYOUT = "claim_payout"
    PENALTY_DEDUCTED = "penalty_deducted"


# =====================================================================
#  SUB-MODELS — Embedded Documents (not top-level collections)
# =====================================================================

class BanRecord(BaseModel):
    """
    An immutable audit entry capturing a single ban event.

    Embedded as an element within `RiderProfile.ban_history`.  Each record
    tracks when a ban was issued, why, and — if applicable — when and why
    it was lifted.
    """

    ban_type: BanType = Field(
        ...,
        description="Severity of the ban that was applied.",
    )
    issued_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp when the ban was issued.",
    )
    reason: str = Field(
        ...,
        min_length=1,
        description="Human-readable justification for the ban.",
    )


# =====================================================================
#  DATABASE MODEL — RiderProfile  (Collection: `riders`)
# =====================================================================

class RiderProfile(BaseModel):
    """
    Core document representing a gig-worker's account state.

    **MongoDB Collection:** ``riders``

    Stores registration details, wallet balance, active policy state,
    ban management flags, and a full audit trail of ban events.
    """

    # --- Identity / Registration -----------------------------------------
    rider_id: str = Field(
        ...,
        min_length=1,
        description="Unique rider identifier (auto-generated, e.g. GIG-XXXXX).",
    )
    name: str = Field(
        ...,
        min_length=1,
        description="Full legal name of the rider.",
    )
    phone: str = Field(
        ...,
        min_length=1,
        description="Primary contact phone number.",
    )
    email: EmailStr = Field(
        ...,
        description="Verified email address (unique, used for login).",
    )
    age: int = Field(
        ...,
        ge=18,
        description="Rider's age; must be 18 or older.",
    )
    city: str = Field(
        ...,
        min_length=1,
        description="City of primary operation.",
    )
    avg_daily_income: float = Field(
        ...,
        ge=0.0,
        description="Self-reported average daily earnings (INR).",
    )
    password: str = Field(
        ...,
        description="Bcrypt-hashed password.",
    )

    # --- Underwriting Eligibility ----------------------------------------
    active_delivery_days: int = Field(
        default=0,
        description="Days worked on the gig platform before applying for cover.",
    )

    # --- OTP / Password Reset --------------------------------------------
    reset_otp: Optional[str] = Field(
        default=None,
        description="6-digit OTP for password reset (transient, cleared after use).",
    )
    otp_expiry: Optional[datetime] = Field(
        default=None,
        description="UTC expiry timestamp for the active reset OTP.",
    )

    # --- Internal Financial State ----------------------------------------
    balance: float = Field(
        default=0.0,
        description="Current wallet balance (INR).",
    )

    # --- Policy State ----------------------------------------------------
    has_active_policy: bool = Field(
        default=False,
        description="Whether the rider currently holds an active policy.",
    )
    active_policy_type: Optional[PolicyType] = Field(
        default=None,
        description="Type of the currently active policy, if any.",
    )
    premium_paid: float = Field(
        default=0.0,
        description="Premium amount (INR) paid for the current active policy.",
    )
    policy_expiry: Optional[datetime] = Field(
        default=None,
        description="UTC expiry timestamp of the active policy.",
    )

    # --- Ban Management --------------------------------------------------
    current_ban_status: BanType = Field(
        default=BanType.NONE,
        description="Current ban state of the account.",
    )

    # --- Audit Trail (Embedded Array) ------------------------------------
    ban_history: List[BanRecord] = Field(
        default_factory=list,
        description="Chronological log of all ban events.",
    )

    # --- Timestamps ------------------------------------------------------
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp when the profile was created.",
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp of the last profile mutation.",
    )


# =====================================================================
#  DATABASE MODEL — TransactionLog  (Collection: `transactions`)
# =====================================================================

class TransactionLog(BaseModel):
    """
    A single entry in the global financial ledger.

    **MongoDB Collection:** ``transactions``

    Every financial movement — premium payments, claim payouts, and
    penalties — is recorded as a separate, immutable document.
    The ``rider_id`` field serves as a logical foreign key back to the
    ``riders`` collection.
    """

    tx_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Globally unique transaction identifier.",
    )
    rider_id: str = Field(
        ...,
        min_length=1,
        description=(
            "Rider ID that this transaction belongs to.  "
            "Acts as a logical foreign key to the `riders` collection."
        ),
    )
    amount: float = Field(
        ...,
        description="Transaction amount (INR). Positive = credit, negative = debit.",
    )
    tx_type: TransactionType = Field(
        ...,
        description="Category of this financial transaction.",
    )
    description: str = Field(
        ...,
        min_length=1,
        description="Human-readable description of the transaction.",
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp when this transaction was recorded.",
    )


# =====================================================================
#  DATABASE MODEL — AdminDashboardMetrics  (Collection: `admin_metrics`)
# =====================================================================

class AdminDashboardMetrics(BaseModel):
    """
    Pre-aggregated snapshot of system-wide KPIs for the admin dashboard.

    **MongoDB Collection:** ``admin_metrics``

    This is a read-optimised document meant to be refreshed periodically
    (or on every relevant mutation) so the admin dashboard can load
    instantly without running expensive aggregation pipelines at query time.
    """

    # --- Policy Metrics --------------------------------------------------
    total_active_policies: int = Field(
        default=0,
        ge=0,
        description="Total number of currently active policies system-wide.",
    )

    # --- Financial Metrics -----------------------------------------------
    total_income: float = Field(
        default=0.0,
        description="Cumulative premium income received (INR).",
    )
    total_payouts: float = Field(
        default=0.0,
        description="Cumulative claim payouts disbursed to riders (INR).",
    )

    # --- Monitoring / Compliance -----------------------------------------
    banned_rider_ids: List[str] = Field(
        default_factory=list,
        description="List of rider_ids that are currently banned.",
    )

    # --- Timestamp -------------------------------------------------------
    last_updated: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp of the last metrics refresh.",
    )


# =====================================================================
#  API REQUEST / RESPONSE SCHEMAS  (No dedicated MongoDB collection)
# =====================================================================
#  These models are used by FastAPI route handlers for request validation
#  and response serialisation.  They are intentionally kept separate from
#  the database document models above.
# =====================================================================

class RegisterRequest(BaseModel):
    """Payload for rider self-registration."""
    name: str = Field(..., min_length=1, description="Full name of the rider")
    phone: str = Field(..., min_length=1, description="Primary contact phone number")
    email: EmailStr = Field(..., description="Email address (used for login)")
    age: int = Field(..., ge=18, description="Rider's age; must be 18 or older")
    city: str = Field(..., min_length=1, description="City of primary operation")
    avg_daily_income: float = Field(..., ge=0.0, description="Self-reported average daily earnings")
    password: str = Field(..., min_length=4, description="Account password")


class LoginRequest(BaseModel):
    """Payload for rider / admin authentication via email."""
    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., min_length=1, description="Account password")


class ClaimRequest(BaseModel):
    """Payload for submitting a parametric insurance claim."""
    latitude: float = Field(..., ge=-90, le=90, description="GPS latitude")
    longitude: float = Field(..., ge=-180, le=180, description="GPS longitude")
    incident_type: str = Field(..., description="Type of incident")
    custom_reason: str = Field("", description="Custom reason if 'other' is selected")


class RevokeRequest(BaseModel):
    """Payload for an admin revoking a rider's ban."""
    rider_id: str = Field(..., min_length=1, description="Rider ID to unban")


# =====================================================================
#  Firebase Auth Bridge — Mobile App Sync (TASK 2)
# =====================================================================

class FirebaseSyncRequest(BaseModel):
    """Payload for syncing a Firebase-authenticated mobile user."""
    email: EmailStr = Field(..., description="User email from Firebase Auth")
    firebase_token: str = Field(..., min_length=1, description="Firebase ID token for verification")
    name: str = Field(..., min_length=1, description="Display name from Firebase Auth")


# =====================================================================
#  ML Engine Premium Hook — Dynamic Pricing (TASK 3)
# =====================================================================

class PremiumRequest(BaseModel):
    """Payload for requesting dynamic ML-based premium pricing."""
    latitude: float = Field(..., ge=-90, le=90, description="GPS latitude of the rider")
    longitude: float = Field(..., ge=-180, le=180, description="GPS longitude of the rider")
    daily_income: float = Field(..., ge=0, description="Rider's average daily income (INR)")
    city: str = Field(..., min_length=1, description="City of operation")
    active_days: int = Field(default=0, ge=0, description="Active delivery days in last 30 days")


class PremiumPlan(BaseModel):
    """A single dynamic insurance plan generated by the ML pricing engine."""
    plan_name: str = Field(..., description="Plan display name (e.g. Basic, Standard, Premium)")
    premium_amount: float = Field(..., ge=0, description="Dynamic premium in INR")
    policy_type: str = Field(..., description="PolicyType value for this plan")
    coverage_details: str = Field(..., description="Human-readable coverage description")


class PremiumResponse(BaseModel):
    """Response from the ML premium pricing engine."""
    is_suspended: bool = Field(
        default=False,
        description="If True, underwriting is suspended due to extreme 14-day weather forecast.",
    )
    forecast_risk: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="ML-computed risk score (0.0 = safe, 1.0 = extreme).",
    )
    plans: List[PremiumPlan] = Field(
        default_factory=list,
        description="Dynamic premium plans adjusted by forecast risk.",
    )
    risk_factors: List[str] = Field(
        default_factory=list,
        description="Human-readable risk factor descriptions.",
    )
