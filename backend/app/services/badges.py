"""
Badge auto-award service — checks unlock rules and awards badges + notifications.
"""

from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.gamification import (
    Badge,
    ChallengeParticipation,
    Notification,
    UserBadge,
)
from app.models.social import ApprovalStatus


def check_badge_unlocks(db: Session, user_id: int, settings: object) -> list[Badge]:
    """
    Evaluate all badge unlock rules for a user and award any newly earned badges.

    If settings.badge_auto_award is False, returns [] immediately (no-op).

    For each unearned badge, checks its unlock_rule JSON:
      - {"type": "xp", "threshold": N}               → unlocked if xp_balance >= N
      - {"type": "challenges_completed", "threshold": N} → unlocked if completed count >= N

    Side-effects for every newly unlocked badge:
      • Creates a UserBadge row.
      • Creates a Notification row (type="badge_unlocked").

    Returns a list of newly unlocked Badge objects.
    """
    if not getattr(settings, "badge_auto_award", False):
        return []

    # ── Gather user stats ────────────────────────────────────────────────
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return []

    xp_balance: int = user.xp_balance or 0

    completed_count: int = (
        db.query(ChallengeParticipation)
        .filter(
            ChallengeParticipation.user_id == user_id,
            ChallengeParticipation.approval_status == ApprovalStatus.approved,
        )
        .count()
    )

    # ── Determine which badges the user already has ──────────────────────
    existing_badge_ids: set[int] = {
        row.badge_id
        for row in db.query(UserBadge.badge_id)
        .filter(UserBadge.user_id == user_id)
        .all()
    }

    # ── Check every badge the user doesn't have yet ──────────────────────
    all_badges: list[Badge] = db.query(Badge).all()
    newly_unlocked: list[Badge] = []

    for badge in all_badges:
        if badge.id in existing_badge_ids:
            continue

        rule: dict = badge.unlock_rule or {}
        rule_type = rule.get("type")
        threshold = rule.get("threshold", 0)

        unlocked = False
        if rule_type == "xp":
            unlocked = xp_balance >= threshold
        elif rule_type == "challenges_completed":
            unlocked = completed_count >= threshold
        # Unknown rule types are silently skipped

        if not unlocked:
            continue

        # ── Award the badge ──────────────────────────────────────────────
        user_badge = UserBadge(user_id=user_id, badge_id=badge.id)
        db.add(user_badge)

        notification = Notification(
            user_id=user_id,
            type="badge_unlocked",
            title=f"Badge unlocked: {badge.name}",
            message=(
                f"Congratulations! You've earned the \"{badge.name}\" badge. "
                f"Keep up the great work!"
            ),
        )
        db.add(notification)

        newly_unlocked.append(badge)

    if newly_unlocked:
        db.commit()

    return newly_unlocked
