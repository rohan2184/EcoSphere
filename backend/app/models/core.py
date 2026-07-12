import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class TimestampMixin:
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

class Department(Base, TimestampMixin):
    __tablename__ = "departments"
    
    name = Column(String, nullable=False)
    code = Column(String, nullable=False)
    # Using use_alter=True to handle the circular dependency with User.department_id
    head_user_id = Column(Integer, ForeignKey("users.id", use_alter=True, name="fk_department_head_user_id"), nullable=True)
    parent_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    employee_count = Column(Integer, default=0)
    status = Column(String)

    # Relationships
    head_user = relationship("User", foreign_keys=[head_user_id], back_populates="managed_departments")
    employees = relationship("User", foreign_keys="User.department_id", back_populates="department")
    sub_departments = relationship("Department", backref="parent", remote_side="Department.id")

class CategoryType(str, enum.Enum):
    csr_activity = "csr_activity"
    challenge = "challenge"

class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    name = Column(String, nullable=False)
    type = Column(Enum(CategoryType), nullable=False)
    status = Column(String)

class Settings(Base, TimestampMixin):
    __tablename__ = "settings"

    auto_emission_calc = Column(Boolean, default=False)
    evidence_required = Column(Boolean, default=False)
    badge_auto_award = Column(Boolean, default=False)
    weight_env = Column(Integer, default=40)
    weight_social = Column(Integer, default=30)
    weight_gov = Column(Integer, default=30)
    notify_email = Column(Boolean, default=True)
    notify_inapp = Column(Boolean, default=True)
    
    from sqlalchemy import JSON
    notification_prefs = Column(JSON, default=dict)
