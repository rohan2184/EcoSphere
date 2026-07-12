"""
Pydantic schemas for Notifications.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: Optional[str] = None
    is_read: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class NotificationUnreadCount(BaseModel):
    count: int
