"""
Password hashing + JWT helpers (plan §8: Person A).

Uses bcrypt directly — passlib 1.7.4 is incompatible with bcrypt>=4.1
(reads a removed __about__ attribute), and bcrypt alone covers everything
we need.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

from app.core.config import settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # malformed hash in DB — treat as auth failure, not a 500
        return False


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MIN)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Return the token payload. Raises jose.JWTError on invalid/expired token."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
