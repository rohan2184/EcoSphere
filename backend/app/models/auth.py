import enum
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.core import TimestampMixin

class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    employee = "employee"

class User(Base, TimestampMixin):
    __tablename__ = "users"
    
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", use_alter=True, name="fk_user_department_id"), nullable=True)
    xp_balance = Column(Integer, default=0)
    points_balance = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    # Relationships
    department = relationship("Department", foreign_keys=[department_id], back_populates="employees")
    managed_departments = relationship("Department", foreign_keys="Department.head_user_id", back_populates="head_user")
