"""
Shared FastAPI dependencies — DB session, auth stubs, settings stubs.
"""

from sqlalchemy.orm import Session

from app.core.database import SessionLocal


# ── Database Session ─────────────────────────────────────────────────────────

def get_db():
    """Yield a SQLAlchemy session and ensure it closes after the request."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Auth Stub ────────────────────────────────────────────────────────────────

def get_current_user() -> dict:
    """
    Return a hardcoded fake user for development.

    TODO: Replace with Person A's real JWT auth once merged.
          Should decode the Authorization header, validate the token,
          and return the full User ORM object.
    """
    return {"id": 1, "role": "admin"}


# ── Settings Stub ────────────────────────────────────────────────────────────

class _SettingsStub:
    """Minimal object matching the fields approve_participation() reads."""
    evidence_required: bool = True


def get_settings_stub() -> _SettingsStub:
    """
    Return a placeholder settings object.

    TODO: Replace with real Settings lookup once Person A's Settings model
          lands. Should query db for the singleton Settings row.
    """
    return _SettingsStub()
