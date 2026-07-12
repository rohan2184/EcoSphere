from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.core import CategoryType
from app.models.auth import UserRole

# Department Schemas
class DepartmentBase(BaseModel):
    name: str
    code: str
    head_user_id: Optional[int] = None
    parent_id: Optional[int] = None
    employee_count: int = 0
    status: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    head_user_id: Optional[int] = None
    parent_id: Optional[int] = None
    employee_count: Optional[int] = None
    status: Optional[str] = None

class DepartmentOut(DepartmentBase):
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# Category Schemas
class CategoryBase(BaseModel):
    name: str
    type: CategoryType
    status: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[CategoryType] = None
    status: Optional[str] = None

class CategoryOut(CategoryBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

# Settings Schemas
class SettingsBase(BaseModel):
    auto_emission_calc: bool = False
    evidence_required: bool = False
    badge_auto_award: bool = False
    weight_env: int = 40
    weight_social: int = 30
    weight_gov: int = 30
    notify_email: bool = True
    notify_inapp: bool = True
    notification_prefs: dict = {}

class SettingsUpdate(BaseModel):
    auto_emission_calc: Optional[bool] = None
    evidence_required: Optional[bool] = None
    badge_auto_award: Optional[bool] = None
    weight_env: Optional[int] = None
    weight_social: Optional[int] = None
    weight_gov: Optional[int] = None
    notify_email: Optional[bool] = None
    notify_inapp: Optional[bool] = None
    notification_prefs: Optional[dict] = None

class SettingsOut(SettingsBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

# User Admin Update Schema
class UserAdminUpdate(BaseModel):
    role: Optional[UserRole] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None

from app.schemas.auth import RegisterIn

class UserCreate(RegisterIn):
    role: Optional[UserRole] = UserRole.employee
    department_id: Optional[int] = None

