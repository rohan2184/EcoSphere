"""
Pydantic schemas for the Social module (CSR Activities & Employee Participation).
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── CSR Activity Schemas ─────────────────────────────────────────────────────

class CSRActivityCreate(BaseModel):
    title: str
    category_id: int
    description: str
    date: date
    location: str
    points_value: int = Field(ge=0)
    status: str = "draft"


class CSRActivityUpdate(BaseModel):
    """All fields optional — send only what you want to change."""
    title: Optional[str] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    date: Optional[date] = None
    location: Optional[str] = None
    points_value: Optional[int] = Field(default=None, ge=0)
    status: Optional[str] = None


class CSRActivityOut(BaseModel):
    id: int
    title: str
    category_id: int
    description: str
    date: date
    location: str
    points_value: int
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Employee Participation Schemas ───────────────────────────────────────────

class EmployeeParticipationCreate(BaseModel):
    """User-facing payload — user submits which activity and optional proof."""
    csr_activity_id: int
    proof_file: Optional[str] = None


class ApprovalDecision(str, Enum):
    """Restricted to the two terminal states an admin can set."""
    approved = "approved"
    rejected = "rejected"


class EmployeeParticipationApprove(BaseModel):
    """Admin action to approve or reject a participation."""
    approval_status: ApprovalDecision


class EmployeeParticipationOut(BaseModel):
    id: int
    user_id: int
    csr_activity_id: int
    proof_file: Optional[str] = None
    approval_status: str
    points_earned: int
    completion_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
