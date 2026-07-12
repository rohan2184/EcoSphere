"""
Gamification module router — Challenges, Participation, Badges, Rewards,
Leaderboard endpoints.

Wire into main.py with:
    app.include_router(gamification.router, prefix="/api")
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, get_settings
from app.models.auth import User
from app.models.gamification import Badge, UserBadge
from app.schemas.gamification import (
    BadgeOut,
    ChallengeCreate,
    ChallengeOut,
    ChallengeParticipationApprove,
    ChallengeParticipationCreate,
    ChallengeParticipationOut,
    ChallengeParticipationUpdate,
    ChallengeStatusUpdate,
    ChallengeUpdate,
    RewardOut,
    RewardRedemptionOut,
    UserBadgeOut,
)
from app.services.gamification import (
    approve_challenge_participation,
    create_challenge,
    get_challenge,
    list_challenges,
    submit_challenge_participation,
    transition_challenge_status,
    update_challenge,
    update_participation_progress,
)
from app.services.rewards import list_rewards, redeem_reward

router = APIRouter(prefix="/gamification", tags=["Gamification"])


# ── Helper ───────────────────────────────────────────────────────────────────

def _require_admin(current_user: dict) -> None:
    """Raise 403 if the caller is not an admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


# ── Challenges ───────────────────────────────────────────────────────────────

@router.post(
    "/challenges",
    response_model=ChallengeOut,
    status_code=status.HTTP_201_CREATED,
)
def create_new_challenge(
    data: ChallengeCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create a new challenge (admin only)."""
    _require_admin(current_user)
    return create_challenge(db, data)


@router.get("/challenges", response_model=list[ChallengeOut])
def list_all_challenges(
    status_filter: Optional[str] = Query(None, alias="status"),
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List challenges with optional filters (any authenticated user)."""
    return list_challenges(db, status=status_filter, category_id=category_id)


@router.get("/challenges/{challenge_id}", response_model=ChallengeOut)
def get_single_challenge(
    challenge_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get a single challenge by ID."""
    challenge = get_challenge(db, challenge_id)
    if challenge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Challenge {challenge_id} not found",
        )
    return challenge


@router.patch("/challenges/{challenge_id}", response_model=ChallengeOut)
def patch_challenge(
    challenge_id: int,
    data: ChallengeUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Partially update a challenge (admin only, draft status only)."""
    _require_admin(current_user)
    try:
        challenge = update_challenge(db, challenge_id, data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )
    if challenge is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Challenge {challenge_id} not found",
        )
    return challenge


@router.patch(
    "/challenges/{challenge_id}/status", response_model=ChallengeOut
)
def transition_status(
    challenge_id: int,
    body: ChallengeStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Transition a challenge to a new lifecycle status (admin only)."""
    _require_admin(current_user)
    try:
        return transition_challenge_status(db, challenge_id, body.new_status)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )


# ── Challenge Participations ────────────────────────────────────────────────

@router.post(
    "/challenge-participations",
    response_model=ChallengeParticipationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_participation(
    data: ChallengeParticipationCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Submit participation for the current user (any authenticated user)."""
    try:
        return submit_challenge_participation(
            db,
            user_id=current_user["id"],
            challenge_id=data.challenge_id,
            progress=data.progress,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )


@router.patch(
    "/challenge-participations/{participation_id}",
    response_model=ChallengeParticipationOut,
)
def update_my_participation(
    participation_id: int,
    data: ChallengeParticipationUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Update progress / proof_file on your own participation."""
    try:
        return update_participation_progress(
            db,
            participation_id=participation_id,
            user_id=current_user["id"],
            progress=data.progress,
            proof_file=data.proof_file,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own participation",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )


@router.patch(
    "/challenge-participations/{participation_id}/approve",
    response_model=ChallengeParticipationOut,
)
def approve_or_reject_participation(
    participation_id: int,
    body: ChallengeParticipationApprove,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Admin approves or rejects a challenge participation.

    Returns 400 if a business rule is violated (e.g. missing proof file).
    Returns 404 if the participation does not exist.
    """
    _require_admin(current_user)
    settings = get_settings(db)
    try:
        return approve_challenge_participation(
            db,
            participation_id=participation_id,
            decision=body.approval_status.value,
            settings=settings,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )


# ── Badges ─────────────────────────────────────────────────────────────────────

@router.get("/badges", response_model=list[BadgeOut])
def list_all_badges(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List all available badges."""
    return db.query(Badge).all()


@router.get("/users/{user_id}/badges", response_model=list[UserBadgeOut])
def get_user_badges(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List all badges earned by a specific user."""
    rows = (
        db.query(
            UserBadge.id,
            UserBadge.user_id,
            UserBadge.badge_id,
            UserBadge.awarded_at,
            Badge.name.label("badge_name"),
        )
        .join(Badge, Badge.id == UserBadge.badge_id)
        .filter(UserBadge.user_id == user_id)
        .all()
    )
    return [
        UserBadgeOut(
            id=r.id,
            user_id=r.user_id,
            badge_id=r.badge_id,
            awarded_at=r.awarded_at,
            badge_name=r.badge_name,
        )
        for r in rows
    ]


# ── Rewards ────────────────────────────────────────────────────────────────────

@router.get("/rewards", response_model=list[RewardOut])
def list_available_rewards(
    status_filter: Optional[str] = Query(None, alias="status"),
    include_out_of_stock: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List rewards (defaults to in-stock only)."""
    return list_rewards(
        db, status_filter=status_filter, include_out_of_stock=include_out_of_stock
    )


@router.post(
    "/rewards/{reward_id}/redeem",
    response_model=RewardRedemptionOut,
    status_code=status.HTTP_201_CREATED,
)
def redeem_a_reward(
    reward_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Redeem a reward using the current user's points balance."""
    try:
        return redeem_reward(db, user_id=current_user["id"], reward_id=reward_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )


# ── Leaderboard ────────────────────────────────────────────────────────────────

@router.get("/leaderboard")
def get_leaderboard(
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Return top N users ranked by XP balance (descending)."""
    rows = (
        db.query(User.id, User.name, User.xp_balance)
        .filter(User.is_active == True)  # noqa: E712
        .order_by(desc(User.xp_balance))
        .limit(limit)
        .all()
    )
    return [
        {"rank": idx + 1, "user_id": r.id, "name": r.name, "xp_balance": r.xp_balance or 0}
        for idx, r in enumerate(rows)
    ]
