"""
Pydantic schemas for the Gamification module (Challenges & Challenge Participation).
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Challenge Schemas ────────────────────────────────────────────────────────

class ChallengeCreate(BaseModel):
    title: str
    category_id: Optional[int] = None
    description: Optional[str] = None
    xp: int = Field(default=0, ge=0)
    difficulty: Optional[str] = None
    evidence_required: bool = False
    deadline: Optional[date] = None
    status: str = "draft"


class ChallengeUpdate(BaseModel):
    """All fields optional — send only what you want to change."""
    title: Optional[str] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    xp: Optional[int] = Field(default=None, ge=0)
    difficulty: Optional[str] = None
    evidence_required: Optional[bool] = None
    deadline: Optional[date] = None


class ChallengeStatusUpdate(BaseModel):
    """Admin action to transition a challenge's lifecycle status."""
    new_status: str


class ChallengeOut(BaseModel):
    id: int
    title: str
    category_id: Optional[int] = None
    description: Optional[str] = None
    xp: int
    difficulty: Optional[str] = None
    evidence_required: bool
    deadline: Optional[date] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Challenge Participation Schemas ──────────────────────────────────────────

class ChallengeParticipationCreate(BaseModel):
    """User submits: which challenge, optional initial progress."""
    challenge_id: int
    progress: int = Field(default=0, ge=0, le=100)


class ChallengeParticipationUpdate(BaseModel):
    """User updates their own progress and/or proof file."""
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    proof_file: Optional[str] = None


class ChallengeApprovalDecision(str, Enum):
    """Restricted to the two terminal states an admin can set."""
    approved = "approved"
    rejected = "rejected"


class ChallengeParticipationApprove(BaseModel):
    """Admin action to approve or reject a participation."""
    approval_status: ChallengeApprovalDecision


class ChallengeParticipationOut(BaseModel):
    id: int
    challenge_id: int
    user_id: int
    progress: int
    proof_file: Optional[str] = None
    approval_status: str
    xp_awarded: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Badge Schemas ────────────────────────────────────────────────────────────

class BadgeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    unlock_rule: dict
    icon: Optional[str] = None


class BadgeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    unlock_rule: Optional[dict] = None
    icon: Optional[str] = None


class BadgeOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    unlock_rule: dict
    icon: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserBadgeOut(BaseModel):
    id: int
    user_id: int
    badge_id: int
    awarded_at: datetime
    badge_name: Optional[str] = None  # populated via join in the router

    model_config = {"from_attributes": True}


# ── Reward Schemas ───────────────────────────────────────────────────────────

class RewardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    points_required: Optional[int] = None
    stock: Optional[int] = None
    status: Optional[str] = None

class RewardOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    points_required: int
    stock: int
    status: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RewardRedemptionOut(BaseModel):
    id: int
    user_id: int
    reward_id: int
    points_spent: int
    redeemed_at: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
