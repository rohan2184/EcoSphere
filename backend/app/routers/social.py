"""
Social module router — CSR Activities & Employee Participation endpoints.

Wire into main.py with:
    app.include_router(social.router, prefix="/api")
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, get_settings_stub
from app.schemas.reports import SocialReportOut
from app.services.reports import get_social_report
from app.schemas.social import (
    CSRActivityCreate,
    CSRActivityOut,
    CSRActivityUpdate,
    EmployeeParticipationApprove,
    EmployeeParticipationCreate,
    EmployeeParticipationOut,
)
from app.services.social import (
    approve_participation,
    create_csr_activity,
    get_csr_activity,
    list_csr_activities,
    submit_participation,
    update_csr_activity,
)

router = APIRouter(prefix="/social", tags=["Social"])


# ── Helper ───────────────────────────────────────────────────────────────────

def _require_admin(current_user: dict) -> None:
    """Raise 403 if the caller is not an admin."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


# ── CSR Activities ───────────────────────────────────────────────────────────

@router.post(
    "/csr-activities",
    response_model=CSRActivityOut,
    status_code=status.HTTP_201_CREATED,
)
def create_activity(
    data: CSRActivityCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create a new CSR activity (admin only)."""
    _require_admin(current_user)
    return create_csr_activity(db, data)


@router.get("/csr-activities", response_model=list[CSRActivityOut])
def list_activities(
    status_filter: Optional[str] = Query(None, alias="status"),
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List CSR activities with optional filters (any authenticated user)."""
    return list_csr_activities(db, status=status_filter, category_id=category_id)


@router.get("/csr-activities/{activity_id}", response_model=CSRActivityOut)
def get_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get a single CSR activity by ID."""
    activity = get_csr_activity(db, activity_id)
    if activity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CSR activity {activity_id} not found",
        )
    return activity


@router.patch("/csr-activities/{activity_id}", response_model=CSRActivityOut)
def patch_activity(
    activity_id: int,
    data: CSRActivityUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Partially update a CSR activity (admin only)."""
    _require_admin(current_user)
    activity = update_csr_activity(db, activity_id, data)
    if activity is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CSR activity {activity_id} not found",
        )
    return activity


# ── Employee Participation ───────────────────────────────────────────────────


@router.post(
    "/participations",
    response_model=EmployeeParticipationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_participation(
    data: EmployeeParticipationCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Submit participation for the current user (any authenticated user)."""
    return submit_participation(
        db,
        user_id=current_user["id"],
        csr_activity_id=data.csr_activity_id,
        proof_file=data.proof_file,
    )



@router.patch(
    "/participations/{participation_id}/approve",
    response_model=EmployeeParticipationOut,
)
def approve_or_reject_participation(
    participation_id: int,
    body: EmployeeParticipationApprove,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Admin approves or rejects a participation.

    Returns 400 if a business rule is violated (e.g. missing proof file).
    Returns 404 if the participation does not exist.
    """
    _require_admin(current_user)
    settings = get_settings_stub()
    try:
        return approve_participation(
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


@router.get("/report", response_model=SocialReportOut)
def social_report(
    department_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Generate Social module report with department/date/employee filters (Admin only).
    """
    _require_admin(current_user)
    return get_social_report(
        db,
        department_id=department_id,
        date_from=date_from,
        date_to=date_to,
        employee_id=employee_id,
    )

