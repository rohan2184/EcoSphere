"""
Business logic for the Gamification module — Challenges & Challenge Participation,
XP/Points balance syncing.

All functions are plain functions that receive a SQLAlchemy Session.
"""

from typing import Optional

from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.gamification import (
    Challenge,
    ChallengeParticipation,
    ChallengeStatus,
)
from app.models.social import ApprovalStatus, EmployeeParticipation
from app.schemas.gamification import ChallengeCreate, ChallengeUpdate


# ── Status transition rules ──────────────────────────────────────────────────

VALID_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"active", "archived"},
    "active": {"under_review", "archived"},
    "under_review": {"completed", "active", "archived"},  # can bounce back to active
    "completed": set(),   # terminal
    "archived": set(),    # terminal
}


# ── Challenge CRUD ───────────────────────────────────────────────────────────

def create_challenge(db: Session, data: ChallengeCreate) -> Challenge:
    """Create a new challenge (always starts in draft by default)."""
    challenge = Challenge(**data.model_dump())
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return challenge


def list_challenges(
    db: Session,
    *,
    status: Optional[str] = None,
    category_id: Optional[int] = None,
) -> list[Challenge]:
    """Return challenges, optionally filtered by status and/or category."""
    query = db.query(Challenge)
    if status is not None:
        query = query.filter(Challenge.status == status)
    if category_id is not None:
        query = query.filter(Challenge.category_id == category_id)
    return query.all()


def get_challenge(db: Session, challenge_id: int) -> Optional[Challenge]:
    """Return a single challenge or None."""
    return db.query(Challenge).filter(Challenge.id == challenge_id).first()


def update_challenge(
    db: Session, challenge_id: int, data: ChallengeUpdate
) -> Optional[Challenge]:
    """
    Patch-update an existing challenge.

    Only allowed while the challenge is in 'draft' status.
    Returns None if not found; raises ValueError if not in draft.
    """
    challenge = get_challenge(db, challenge_id)
    if challenge is None:
        return None

    current = challenge.status
    # Normalise: could be a ChallengeStatus enum instance or a plain string
    current_str = current.value if isinstance(current, ChallengeStatus) else str(current)
    if current_str != "draft":
        raise ValueError(
            f"Challenge can only be edited in 'draft' status (current: '{current_str}')"
        )

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(challenge, field, value)
    db.commit()
    db.refresh(challenge)
    return challenge


# ── Challenge Status Transitions ─────────────────────────────────────────────

def transition_challenge_status(
    db: Session, challenge_id: int, new_status: str
) -> Challenge:
    """
    Move a challenge to a new lifecycle status.

    Validates the transition against VALID_TRANSITIONS; raises ValueError
    with a clear message if the transition is not allowed.
    """
    challenge = get_challenge(db, challenge_id)
    if challenge is None:
        raise LookupError(f"Challenge {challenge_id} not found")

    current = challenge.status
    current_str = current.value if isinstance(current, ChallengeStatus) else str(current)

    allowed = VALID_TRANSITIONS.get(current_str, set())
    if new_status not in allowed:
        if not allowed:
            raise ValueError(
                f"Challenge status '{current_str}' is terminal — no transitions allowed"
            )
        raise ValueError(
            f"Cannot transition from '{current_str}' to '{new_status}'. "
            f"Allowed transitions: {sorted(allowed)}"
        )

    challenge.status = new_status
    db.commit()
    db.refresh(challenge)
    return challenge


# ── Challenge Participation ──────────────────────────────────────────────────

def submit_challenge_participation(
    db: Session,
    user_id: int,
    challenge_id: int,
    progress: int = 0,
    proof_file: Optional[str] = None,
) -> ChallengeParticipation:
    """
    An employee joins a challenge.

    Only allowed if the challenge's current status is 'active'.
    """
    challenge = get_challenge(db, challenge_id)
    if challenge is None:
        raise LookupError(f"Challenge {challenge_id} not found")

    current = challenge.status
    current_str = current.value if isinstance(current, ChallengeStatus) else str(current)
    if current_str != "active":
        raise ValueError("Challenge is not active")

    participation = ChallengeParticipation(
        challenge_id=challenge_id,
        user_id=user_id,
        progress=progress,
        proof_file=proof_file,
        approval_status=ApprovalStatus.pending,
        xp_awarded=0,
    )
    db.add(participation)
    db.commit()
    db.refresh(participation)
    return participation


def update_participation_progress(
    db: Session,
    participation_id: int,
    user_id: int,
    progress: Optional[int] = None,
    proof_file: Optional[str] = None,
) -> ChallengeParticipation:
    """
    User updates their own participation progress / proof_file.

    • Only the owning user may update (checked via user_id).
    • Only allowed while approval_status is 'pending'.
    """
    participation = (
        db.query(ChallengeParticipation)
        .filter(ChallengeParticipation.id == participation_id)
        .first()
    )
    if participation is None:
        raise LookupError(f"Participation {participation_id} not found")

    if participation.user_id != user_id:
        raise PermissionError("You can only update your own participation")

    current_approval = participation.approval_status
    approval_str = (
        current_approval.value
        if isinstance(current_approval, ApprovalStatus)
        else str(current_approval)
    )
    if approval_str != "pending":
        raise ValueError(
            f"Cannot update participation — approval status is already '{approval_str}'"
        )

    if progress is not None:
        participation.progress = progress
    if proof_file is not None:
        participation.proof_file = proof_file

    db.commit()
    db.refresh(participation)
    return participation


def approve_challenge_participation(
    db: Session,
    participation_id: int,
    decision: str,
    settings: object,
) -> ChallengeParticipation:
    """
    Admin approves or rejects a challenge participation.

    Business rules:
      • rejected  → set approval_status, xp_awarded stays 0.
      • approved  → if (settings.evidence_required OR challenge.evidence_required)
                     AND proof_file is missing → raise ValueError.
                     Otherwise set approval_status='approved', xp_awarded = challenge.xp.

    NOTE: This function does NOT update user.xp_balance directly.
    """
    participation = (
        db.query(ChallengeParticipation)
        .filter(ChallengeParticipation.id == participation_id)
        .first()
    )
    if participation is None:
        raise LookupError(f"Participation {participation_id} not found")

    if decision == "rejected":
        participation.approval_status = ApprovalStatus.rejected
        participation.xp_awarded = 0
        db.commit()
        db.refresh(participation)
        return participation

    # decision == "approved"
    challenge = (
        db.query(Challenge)
        .filter(Challenge.id == participation.challenge_id)
        .first()
    )
    if challenge is None:
        raise LookupError(
            f"Linked challenge {participation.challenge_id} not found"
        )

    # Evidence check: either global settings or per-challenge flag
    evidence_needed = getattr(settings, "evidence_required", False) or bool(
        challenge.evidence_required
    )
    if evidence_needed and not participation.proof_file:
        raise ValueError("Proof file required for approval")

    participation.approval_status = ApprovalStatus.approved
    participation.xp_awarded = challenge.xp or 0

    db.commit()
    db.refresh(participation)

    # Sync XP balance and check for badge unlocks
    sync_user_xp(db, participation.user_id)

    # Import here to avoid circular import at module level
    from app.services.badges import check_badge_unlocks
    check_badge_unlocks(db, participation.user_id, settings)

    return participation


# ── XP / Points Balance Syncing ──────────────────────────────────────────────

def sync_user_xp(db: Session, user_id: int) -> int:
    """
    Recompute user.xp_balance as the SUM of xp_awarded across all their
    approved ChallengeParticipation rows, and persist it.

    Returns the new xp_balance.
    """
    total_xp = (
        db.query(sa_func.coalesce(sa_func.sum(ChallengeParticipation.xp_awarded), 0))
        .filter(
            ChallengeParticipation.user_id == user_id,
            ChallengeParticipation.approval_status == ApprovalStatus.approved,
        )
        .scalar()
    )
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise LookupError(f"User {user_id} not found")

    user.xp_balance = int(total_xp)
    db.commit()
    db.refresh(user)
    return user.xp_balance


def sync_user_points(db: Session, user_id: int) -> int:
    """
    Recompute user.points_balance as the SUM of points_earned across all their
    approved EmployeeParticipation rows, and persist it.

    Returns the new points_balance.
    """
    total_points = (
        db.query(sa_func.coalesce(sa_func.sum(EmployeeParticipation.points_earned), 0))
        .filter(
            EmployeeParticipation.user_id == user_id,
            EmployeeParticipation.approval_status == ApprovalStatus.approved,
        )
        .scalar()
    )
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise LookupError(f"User {user_id} not found")

    user.points_balance = int(total_points)
    db.commit()
    db.refresh(user)
    return user.points_balance
