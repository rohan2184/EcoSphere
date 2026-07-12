import enum
from sqlalchemy import Column, Integer, String, Boolean, Float, Text, Date, ForeignKey, Enum
from sqlalchemy.orm import relationship
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
    unit = Column(String, nullable=False)  # e.g. "kg", "liter", "kWh"
    factor_value = Column(Float, nullable=False)  # kg CO2e per unit
    status = Column(String)


class ProductESGProfile(Base, TimestampMixin):
    __tablename__ = "product_esg_profiles"

    product_name = Column(String, nullable=False)
    category = Column(String)
    default_emission_factor_id = Column(Integer, ForeignKey("emission_factors.id"), nullable=True)
    notes = Column(Text, nullable=True)

    default_emission_factor = relationship("EmissionFactor")


class CarbonTransaction(Base, TimestampMixin):
    __tablename__ = "carbon_transactions"

    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    source_type = Column(Enum(SourceType), nullable=False)
    # Free-text reference to the originating record; this demo has no real
    # Purchase/Manufacturing tables to FK against.
    source_ref = Column(String, nullable=True)
    quantity = Column(Float, nullable=False)
    emission_factor_id = Column(Integer, ForeignKey("emission_factors.id"), nullable=False)
    co2e_amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    auto_generated = Column(Boolean, default=False)

    department = relationship("Department")
    emission_factor = relationship("EmissionFactor")


class EnvironmentalGoal(Base, TimestampMixin):
    __tablename__ = "environmental_goals"

    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)  # null = org-wide goal
    metric = Column(String, nullable=False)  # e.g. "total_co2e", "emission_intensity"
    target_value = Column(Float, nullable=False)
    current_value = Column(Float, default=0)
    deadline = Column(Date)
    status = Column(String)

    department = relationship("Department")
