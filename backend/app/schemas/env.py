from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime
from app.models.env import SourceType


# EmissionFactor Schemas
class EmissionFactorBase(BaseModel):
    name: str
    source_type: SourceType
    unit: str
    factor_value: float
    status: Optional[str] = None


class EmissionFactorCreate(EmissionFactorBase):
    pass


class EmissionFactorUpdate(BaseModel):
    name: Optional[str] = None
    source_type: Optional[SourceType] = None
    unit: Optional[str] = None
    factor_value: Optional[float] = None
    status: Optional[str] = None


class EmissionFactorOut(EmissionFactorBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ProductESGProfile Schemas
class ProductESGProfileBase(BaseModel):
    product_name: str
    category: Optional[str] = None
    default_emission_factor_id: Optional[int] = None
    notes: Optional[str] = None


class ProductESGProfileCreate(ProductESGProfileBase):
    pass


class ProductESGProfileUpdate(BaseModel):
    product_name: Optional[str] = None
    category: Optional[str] = None
    default_emission_factor_id: Optional[int] = None
    notes: Optional[str] = None


class ProductESGProfileOut(ProductESGProfileBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# CarbonTransaction Schemas
class CarbonTransactionBase(BaseModel):
    department_id: int
    source_type: SourceType
    source_ref: Optional[str] = None
    quantity: float
    emission_factor_id: int
    co2e_amount: float
    date: date


class CarbonTransactionCreate(CarbonTransactionBase):
    # co2e_amount may be ignored server-side when Settings.auto_emission_calc is on.
    pass


class CarbonTransactionUpdate(BaseModel):
    department_id: Optional[int] = None
    source_type: Optional[SourceType] = None
    source_ref: Optional[str] = None
    quantity: Optional[float] = None
    emission_factor_id: Optional[int] = None
    co2e_amount: Optional[float] = None
    date: Optional[date] = None


class CarbonTransactionOut(CarbonTransactionBase):
    id: int
    auto_generated: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# EnvironmentalGoal Schemas
class EnvironmentalGoalBase(BaseModel):
    department_id: Optional[int] = None  # null = org-wide goal
    metric: str
    target_value: float
    current_value: float = 0
    deadline: Optional[date] = None
    status: Optional[str] = None


class EnvironmentalGoalCreate(EnvironmentalGoalBase):
    pass


class EnvironmentalGoalUpdate(BaseModel):
    department_id: Optional[int] = None
    metric: Optional[str] = None
    target_value: Optional[float] = None
    current_value: Optional[float] = None  # allow progress tracking
    deadline: Optional[date] = None
    status: Optional[str] = None


class EnvironmentalGoalOut(EnvironmentalGoalBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
