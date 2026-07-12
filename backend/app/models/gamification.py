"""
Gamification module models – challenges, badges, rewards, and redemptions.

All models use SQLAlchemy 2.0 Mapped / mapped_column style.
"""

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


# ── Enums ────────────────────────────────────────────────────────────────────

class ChallengeStatus(str, enum.Enum):
    """Lifecycle status of a challenge."""
    draft = "draft"
    active = "active"
    under_review = "under_review"
    completed = "completed"
    archived = "archived"


class ChallengeApprovalStatus(str, enum.Enum):
    """Approval workflow status for challenge participation submissions."""
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


# ── Models ───────────────────────────────────────────────────────────────────

class Challenge(Base):
    """A gamified challenge employees can participate in to earn XP."""

    __tablename__ = "challenges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("categories.id"), index=True, nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    xp: Mapped[int] = mapped_column(Integer, nullable=False)
    difficulty: Mapped[str] = mapped_column(String, nullable=False)
    evidence_required: Mapped[bool] = mapped_column(Boolean, default=False)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[ChallengeStatus] = mapped_column(
        Enum(ChallengeStatus, name="challenge_status", create_constraint=True),
        nullable=False,
        server_default=ChallengeStatus.draft.value,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<Challenge(id={self.id}, title='{self.title}', "
            f"xp={self.xp}, status='{self.status}')>"
        )


class ChallengeParticipation(Base):
    """Tracks an employee's progress and submission for a challenge."""

    __tablename__ = "challenge_participations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    challenge_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("challenges.id"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), index=True, nullable=False
    )
    progress: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    proof_file: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    approval_status: Mapped[ChallengeApprovalStatus] = mapped_column(
        Enum(
            ChallengeApprovalStatus,
            name="challenge_approval_status",
            create_constraint=True,
        ),
        nullable=False,
        server_default=ChallengeApprovalStatus.pending.value,
    )
    xp_awarded: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<ChallengeParticipation(id={self.id}, challenge_id={self.challenge_id}, "
            f"user_id={self.user_id}, progress={self.progress}%)>"
        )


class Badge(Base):
    """An unlockable badge awarded based on configurable rules."""

    __tablename__ = "badges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    unlock_rule: Mapped[dict] = mapped_column(
        JSON, nullable=False
    )  # e.g. {"type": "xp", "threshold": 500}
    icon: Mapped[str] = mapped_column(String, nullable=False)  # URL or emoji

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<Badge(id={self.id}, name='{self.name}')>"


class UserBadge(Base):
    """Junction table recording which badges a user has earned."""

    __tablename__ = "user_badges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), index=True, nullable=False
    )
    badge_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("badges.id"), index=True, nullable=False
    )
    awarded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<UserBadge(id={self.id}, user_id={self.user_id}, "
            f"badge_id={self.badge_id})>"
        )


class Reward(Base):
    """A redeemable reward in the points store."""

    __tablename__ = "rewards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    points_required: Mapped[int] = mapped_column(Integer, nullable=False)
    stock: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<Reward(id={self.id}, name='{self.name}', "
            f"points={self.points_required}, stock={self.stock})>"
        )


class RewardRedemption(Base):
    """Records a user redeeming points for a reward."""

    __tablename__ = "reward_redemptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), index=True, nullable=False
    )
    reward_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("rewards.id"), index=True, nullable=False
    )
    points_spent: Mapped[int] = mapped_column(Integer, nullable=False)
    redeemed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<RewardRedemption(id={self.id}, user_id={self.user_id}, "
            f"reward_id={self.reward_id}, points_spent={self.points_spent})>"
        )
