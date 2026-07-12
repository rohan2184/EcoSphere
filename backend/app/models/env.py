import enum
from sqlalchemy import Column, Integer, String, Boolean, Float, Date, ForeignKey, Enum, Text
from app.core.database import Base
from app.models.core import TimestampMixin

class SourceType(str, enum.Enum):
    purchase = "purchase"
    manufacturing = "manufacturing"
    expense = "expense"
    fleet = "fleet"

class EmissionFactor(Base, TimestampMixin):
    __tablename__ = "emission_factors"

    name = Column(String, nullable=False)
    source_type = Column(Enum(SourceType), nullable=False)
    unit = Column(String, nullable=False)
    factor_value = Column(Float, nullable=False)  # kg CO2e per unit
    status = Column(String, default="active")

class ProductESGProfile(Base, TimestampMixin):
    __tablename__ = "product_esg_profiles"

    product_name = Column(String, nullable=False)
    category = Column(String)
    default_emission_factor_id = Column(Integer, ForeignKey("emission_factors.id"), nullable=True)
    notes = Column(Text)

class CarbonTransaction(Base, TimestampMixin):
    __tablename__ = "carbon_transactions"

    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    source_type = Column(Enum(SourceType), nullable=False)
    source_ref = Column(String)
    quantity = Column(Float, nullable=False)
    emission_factor_id = Column(Integer, ForeignKey("emission_factors.id"), nullable=True)
    co2e_amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    auto_generated = Column(Boolean, default=False)

class EnvironmentalGoal(Base, TimestampMixin):
    __tablename__ = "environmental_goals"

    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)  # null = org-wide
    metric = Column(String, nullable=False)
    target_value = Column(Float, nullable=False)
    current_value = Column(Float, default=0)
    deadline = Column(Date)
    status = Column(String, default="active")
