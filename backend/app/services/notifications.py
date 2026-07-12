"""
Notification service — centralised helper for creating in-app notifications
with optional simulated email delivery.
"""

from sqlalchemy.orm import Session

from app.models.gamification import Notification


def create_notification(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    message: str,
    settings: object,
) -> Notification:
    """
    Create an in-app notification and optionally simulate email delivery.

    The Notification row (is_read=False) is always created — in-app is the
    source of truth regardless of settings.

    If settings.notify_email is True, a log line is printed to simulate
    email sending.
    """
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # Simulated email delivery
    if getattr(settings, "notify_email", False):
        # Real email delivery is out of scope for the hackathon MVP.
        # Replace this print with an actual email service integration
        # (e.g. SendGrid, SES) when ready.
        print(f"[EMAIL SIMULATED] to user {user_id}: {title}")

    return notification
