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
    Consults settings.notification_prefs for opt-out toggles per event type.
    """
    prefs = getattr(settings, "notification_prefs", {}) or {}
    event_prefs = prefs.get(type, {})

    notification = None
    if event_prefs.get("inapp", True):
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
    if getattr(settings, "notify_email", False) and event_prefs.get("email", True):
        # Real email delivery is out of scope for the hackathon MVP.
        # Replace this print with an actual email service integration
        # (e.g. SendGrid, SES) when ready.
        print(f"[EMAIL SIMULATED] to user {user_id}: {title}")

    return notification
