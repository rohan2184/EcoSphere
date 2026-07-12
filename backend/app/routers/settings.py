"""
Settings singleton (plan §8: Person A) — GET/PUT /api/settings.

All four automation toggles + scoring weights hang off this row.
GET is open to any authenticated user (frontend reads weights/toggles);
PUT is admin-only.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, get_settings, require_role

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    auto_emission_calc: bool
    evidence_required: bool
    badge_auto_award: bool
    weight_env: int
    weight_social: int
    weight_gov: int
    notify_email: bool
    notify_inapp: bool


class SettingsUpdate(BaseModel):
    auto_emission_calc: bool | None = None
    evidence_required: bool | None = None
    badge_auto_award: bool | None = None
    weight_env: int | None = None
    weight_social: int | None = None
    weight_gov: int | None = None
    notify_email: bool | None = None
    notify_inapp: bool | None = None


@router.get("", response_model=SettingsOut)
def read_settings(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_settings(db)


@router.put("", response_model=SettingsOut)
def update_settings(
    body: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    row = get_settings(db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row
