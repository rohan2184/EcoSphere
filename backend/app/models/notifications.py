"""
Notification model – cross-module notifications for users.

Uses SQLAlchemy 2.0 Mapped / mapped_column style.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class Notification(Base):
    """An in-app notification delivered to a user."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(
        String, nullable=False
    )  # e.g. "badge_unlocked", "compliance_issue", "participation_approved"
    title: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<Notification(id={self.id}, user_id={self.user_id}, "
            f"type='{self.type}', is_read={self.is_read})>"
        )
