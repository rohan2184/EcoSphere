"""
Notifications module router.

Wire into main.py with:
    app.include_router(notifications.router, prefix="/api")
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.gamification import Notification
from app.schemas.notifications import NotificationOut, NotificationUnreadCount

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List current user's notifications, newest first."""
    query = db.query(Notification).filter(Notification.user_id == current_user["id"])
    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712
    return query.order_by(desc(Notification.created_at)).all()


@router.get("/unread-count", response_model=NotificationUnreadCount)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Return the count of unread notifications for the current user."""
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user["id"],
            Notification.is_read == False,  # noqa: E712
        )
        .count()
    )
    return {"count": count}


@router.patch("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Mark all unread notifications as read for the current user."""
    db.query(Notification).filter(
        Notification.user_id == current_user["id"],
        Notification.is_read == False,  # noqa: E712
    ).update({"is_read": True}, synchronize_session=False)
    
    db.commit()
    return {"status": "success", "detail": "All notifications marked as read"}


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Mark a specific notification as read."""
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id)
        .first()
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )
    
    if notification.user_id != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not your notification"
        )

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification
