import enum
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, Enum, Text, JSON
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.core import TimestampMixin
from app.models.social import ApprovalStatus

class ChallengeStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    under_review = "under_review"
    completed = "completed"
    archived = "archived"

class Challenge(Base, TimestampMixin):
    __tablename__ = "challenges"

    title = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    description = Column(Text)
    xp = Column(Integer, default=0)
    difficulty = Column(String)
    evidence_required = Column(Boolean, default=False)
    deadline = Column(Date)
    status = Column(Enum(ChallengeStatus), default=ChallengeStatus.draft, nullable=False)

class ChallengeParticipation(Base, TimestampMixin):
    __tablename__ = "challenge_participations"

    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    progress = Column(Integer, default=0)  # 0-100
    proof_file = Column(String)
    approval_status = Column(Enum(ApprovalStatus), default=ApprovalStatus.pending, nullable=False)
    xp_awarded = Column(Integer, default=0)

class Badge(Base, TimestampMixin):
    __tablename__ = "badges"

    name = Column(String, nullable=False)
    description = Column(Text)
    unlock_rule = Column(JSON, nullable=False)  # {"type": "xp"|"challenges_completed", "threshold": N}
    icon = Column(String)

class UserBadge(Base, TimestampMixin):
    __tablename__ = "user_badges"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    badge_id = Column(Integer, ForeignKey("badges.id"), nullable=False)
    awarded_at = Column(DateTime(timezone=True), server_default=func.now())

class Reward(Base, TimestampMixin):
    __tablename__ = "rewards"

    name = Column(String, nullable=False)
    description = Column(Text)
    points_required = Column(Integer, nullable=False)
    stock = Column(Integer, default=0)
    status = Column(String, default="active")

class RewardRedemption(Base, TimestampMixin):
    __tablename__ = "reward_redemptions"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reward_id = Column(Integer, ForeignKey("rewards.id"), nullable=False)
    points_spent = Column(Integer, nullable=False)
    redeemed_at = Column(DateTime(timezone=True), server_default=func.now())

class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)  # badge_awarded, compliance_overdue, approval, redemption
    title = Column(String, nullable=False)
    message = Column(Text)
    is_read = Column(Boolean, default=False, nullable=False)
