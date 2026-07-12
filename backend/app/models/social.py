"""
Social module models – CSR activities, employee participation, diversity metrics.

All models use SQLAlchemy 2.0 Mapped / mapped_column style.
"""

import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


# ── Enums ────────────────────────────────────────────────────────────────────

class ApprovalStatus(str, enum.Enum):
    """Shared approval workflow status used across social models."""
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


# ── Models ───────────────────────────────────────────────────────────────────

class CSRActivity(Base):
    """A corporate-social-responsibility activity that employees can join."""

    __tablename__ = "csr_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("categories.id"), index=True, nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    location: Mapped[str] = mapped_column(String, nullable=False)
    points_value: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<CSRActivity(id={self.id}, title='{self.title}', "
            f"date={self.date}, status='{self.status}')>"
        )


class EmployeeParticipation(Base):
    """Tracks an employee's participation in a CSR activity."""

    __tablename__ = "employee_participations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), index=True, nullable=False
    )
    csr_activity_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("csr_activities.id"), index=True, nullable=False
    )
    proof_file: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    approval_status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus, name="approval_status", create_constraint=True),
        nullable=False,
        server_default=ApprovalStatus.pending.value,
    )
    points_earned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<EmployeeParticipation(id={self.id}, user_id={self.user_id}, "
            f"activity_id={self.csr_activity_id}, status='{self.approval_status}')>"
        )


class DiversityMetric(Base):
    """Period-level diversity & training metrics for a department."""

    __tablename__ = "diversity_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    department_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id"), index=True, nullable=False
    )
    period: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "2026-Q2"
    gender_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    avg_training_hours: Mapped[float] = mapped_column(Float, nullable=False)
    training_completion_pct: Mapped[float] = mapped_column(Float, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<DiversityMetric(id={self.id}, dept_id={self.department_id}, "
            f"period='{self.period}')>"
        )
