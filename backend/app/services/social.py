"""
Business logic for the Social module — CSR Activities & Employee Participation.

All functions are plain functions that receive a SQLAlchemy Session.
They do NOT manage transactions (the caller / router handles commit).
"""

from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.models.social import CSRActivity, EmployeeParticipation, ApprovalStatus
from app.schemas.social import CSRActivityCreate, CSRActivityUpdate


# ── CSR Activity CRUD ────────────────────────────────────────────────────────

def create_csr_activity(db: Session, data: CSRActivityCreate) -> CSRActivity:
    """Create a new CSR activity."""
    activity = CSRActivity(**data.model_dump())
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


def list_csr_activities(
    db: Session,
    *,
    status: Optional[str] = None,
    category_id: Optional[int] = None,
) -> list[CSRActivity]:
    """Return CSR activities, optionally filtered by status and/or category."""
    query = db.query(CSRActivity)
    if status is not None:
        query = query.filter(CSRActivity.status == status)
    if category_id is not None:
        query = query.filter(CSRActivity.category_id == category_id)
    return query.all()


def get_csr_activity(db: Session, activity_id: int) -> Optional[CSRActivity]:
    """Return a single CSR activity or None."""
    return db.query(CSRActivity).filter(CSRActivity.id == activity_id).first()


def update_csr_activity(
    db: Session, activity_id: int, data: CSRActivityUpdate
) -> Optional[CSRActivity]:
    """Patch-update an existing CSR activity. Returns None if not found."""
    activity = get_csr_activity(db, activity_id)
    if activity is None:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(activity, field, value)
    db.commit()
    db.refresh(activity)
    return activity


# ── Employee Participation ───────────────────────────────────────────────────

def submit_participation(
    db: Session,
    user_id: int,
    csr_activity_id: int,
    proof_file: Optional[str] = None,
) -> EmployeeParticipation:
    """
    An employee signs up for a CSR activity.

    Creates a new EmployeeParticipation row with approval_status="pending".
    """
    participation = EmployeeParticipation(
        user_id=user_id,
        csr_activity_id=csr_activity_id,
        proof_file=proof_file,
        approval_status=ApprovalStatus.pending,
        points_earned=0,
    )
    db.add(participation)
    db.commit()
    db.refresh(participation)
    return participation


def approve_participation(
    db: Session,
    participation_id: int,
    decision: str,
    settings: object,
) -> EmployeeParticipation:
    """
    Admin approves or rejects a participation.

    Business rules:
      • rejected  → set status, no points awarded.
      • approved  → if settings.evidence_required and no proof_file, raise ValueError.
                     Otherwise set status, award points from the linked CSRActivity,
                     stamp completion_date.

    NOTE: This function does NOT update user.points_balance directly.
    A later integration step will sync approved points to the User model
    (e.g. via an event listener or a dedicated reconciliation service).
    """
    participation = (
        db.query(EmployeeParticipation)
        .filter(EmployeeParticipation.id == participation_id)
        .first()
    )
    if participation is None:
        raise LookupError(f"Participation {participation_id} not found")

    if decision == "rejected":
        participation.approval_status = ApprovalStatus.rejected
        participation.points_earned = 0
        db.commit()
        db.refresh(participation)
        return participation

    # decision == "approved"
    if settings.evidence_required and not participation.proof_file:
        raise ValueError("Proof file required for approval")

    # Look up the activity's points_value to award
    activity = (
        db.query(CSRActivity)
        .filter(CSRActivity.id == participation.csr_activity_id)
        .first()
    )
    if activity is None:
        raise LookupError(
            f"Linked CSR activity {participation.csr_activity_id} not found"
        )

    participation.approval_status = ApprovalStatus.approved
    participation.points_earned = activity.points_value
    participation.completion_date = date.today()

    # TODO: sync participation.points_earned → user.points_balance
    #       once the points-balance reconciliation service is built.

    db.commit()
    db.refresh(participation)
    return participation
