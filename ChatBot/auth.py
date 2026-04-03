"""
GigShield — Authentication & Security
Password hashing (bcrypt), JWT creation/verification, FastAPI dependencies.
"""

import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Header, Depends, HTTPException
from config import get_settings
from database import riders_col

settings = get_settings()


# =====================================================================
# Password Hashing
# =====================================================================

def hash_password(plain_password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )


# =====================================================================
# JWT Token Management
# =====================================================================

def create_token(rider_id: str) -> str:
    """Create a JWT token with 2-hour expiry."""
    payload = {
        "sub": rider_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=2),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> str:
    """Decode a JWT token and return the rider_id (subject)."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")


# =====================================================================
# FastAPI Dependencies
# =====================================================================

async def get_current_rider(authorization: str = Header(None)) -> str:
    """Extract and validate rider_id from the Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    token = authorization.split(" ")[1]
    return decode_token(token)


async def verify_admin(rider_id: str = Depends(get_current_rider)):
    """Verify that the current user has admin role."""
    user = await riders_col.find_one({"rider_id": rider_id})
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user
