"""
Shared pytest fixtures for the Social + Gamification test suite.

Uses an in-memory SQLite database so tests are fast, isolated,
and need no external services.  Each test function gets its own
session wrapped in a transaction that is rolled back at the end.
"""

import os
import sys

# ── Ensure app is importable and env vars are set BEFORE any app import ──
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.auth import User  # noqa – registers table
from app.models.core import Department, Category, Settings  # noqa
from app.models.social import CSRActivity, EmployeeParticipation, ApprovalStatus  # noqa
from app.models.gamification import (  # noqa
    Challenge,
    ChallengeParticipation,
    ChallengeStatus,
    Badge,
    UserBadge,
    Reward,
    RewardRedemption,
    Notification,
)


# ── In-memory SQLite engine shared by all tests ──────────────────────────────

_TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
)

# Enable foreign-key enforcement in SQLite (off by default)
@event.listens_for(_TEST_ENGINE, "connect")
def _set_sqlite_pragma(dbapi_conn, _connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

_TestSession = sessionmaker(bind=_TEST_ENGINE, autoflush=False)


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    """Create all tables once for the entire test session."""
    Base.metadata.create_all(bind=_TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=_TEST_ENGINE)


@pytest.fixture()
def db():
    """
    Provide a clean DB session for each test.

    Opens a transaction, binds the session to it, then rolls back
    after the test so every test starts with an empty database.
    """
    connection = _TEST_ENGINE.connect()
    transaction = connection.begin()
    session = _TestSession(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ── Fake Settings ────────────────────────────────────────────────────────────

class FakeSettings:
    """Minimal settings stub for tests — all flags toggleable per-test."""

    def __init__(
        self,
        evidence_required: bool = False,
        badge_auto_award: bool = True,
        notify_email: bool = False,
        notify_inapp: bool = True,
    ):
        self.evidence_required = evidence_required
        self.badge_auto_award = badge_auto_award
        self.notify_email = notify_email
        self.notify_inapp = notify_inapp


@pytest.fixture()
def settings():
    """Default settings: evidence NOT required, badge auto-award ON, email OFF."""
    return FakeSettings()


# ── Factory helpers ──────────────────────────────────────────────────────────

def make_user(db, *, name="Test User", email=None, role="employee",
              xp_balance=0, points_balance=0, **kw):
    """Create and flush a User row with sensible defaults."""
    if email is None:
        # Unique email per call
        import uuid
        email = f"user-{uuid.uuid4().hex[:8]}@test.com"
    u = User(
        name=name,
        email=email,
        password_hash="fakehash",
        role=role,
        xp_balance=xp_balance,
        points_balance=points_balance,
        is_active=True,
        **kw,
    )
    db.add(u)
    db.flush()
    return u


def make_csr_activity(db, *, title="Beach Cleanup", points_value=100,
                      status="active", **kw):
    """Create and flush a CSRActivity row."""
    a = CSRActivity(title=title, points_value=points_value, status=status, **kw)
    db.add(a)
    db.flush()
    return a


def make_challenge(db, *, title="Zero Waste Week", xp=200, status="active",
                   evidence_required=False, **kw):
    """Create and flush a Challenge row."""
    c = Challenge(
        title=title, xp=xp, status=status,
        evidence_required=evidence_required, **kw,
    )
    db.add(c)
    db.flush()
    return c


def make_badge(db, *, name="Eco Starter", rule_type="xp", threshold=100, **kw):
    """Create and flush a Badge row with a standard unlock rule."""
    b = Badge(
        name=name,
        description=f"Test badge ({rule_type} >= {threshold})",
        unlock_rule={"type": rule_type, "threshold": threshold},
        icon="🌱",
        **kw,
    )
    db.add(b)
    db.flush()
    return b


def make_reward(db, *, name="Gift Card", points_required=100, stock=5, **kw):
    """Create and flush a Reward row."""
    r = Reward(
        name=name,
        description="Test reward",
        points_required=points_required,
        stock=stock,
        status="active",
        **kw,
    )
    db.add(r)
    db.flush()
    return r
