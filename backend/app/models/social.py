import enum
from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Enum, Text
from app.core.database import Base
from app.models.core import TimestampMixin

class ApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"

class CSRActivity(Base, TimestampMixin):
    __tablename__ = "csr_activities"

    title = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    description = Column(Text)
    date = Column(Date)
    location = Column(String)
    points_value = Column(Integer, default=0)
    status = Column(String, default="active")

class EmployeeParticipation(Base, TimestampMixin):
    __tablename__ = "employee_participations"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    csr_activity_id = Column(Integer, ForeignKey("csr_activities.id"), nullable=False)
    proof_file = Column(String)
    approval_status = Column(Enum(ApprovalStatus), default=ApprovalStatus.pending, nullable=False)
    points_earned = Column(Integer, default=0)
    completion_date = Column(Date)

class DiversityMetric(Base, TimestampMixin):
    __tablename__ = "diversity_metrics"

    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    period = Column(String, nullable=False)  # e.g. "2026-Q2"
    gender_ratio = Column(Float)             # 0-100, % of underrepresented gender
    avg_training_hours = Column(Float)
    training_completion_pct = Column(Float)
