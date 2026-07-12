import enum
from datetime import date
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Enum, Text
from sqlalchemy.sql import func
from app.core.database import Base
from app.models.core import TimestampMixin

class IssueSeverity(str, enum.Enum):
    low = "low"
    med = "med"
    high = "high"
    critical = "critical"

class IssueStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"

class ESGPolicy(Base, TimestampMixin):
    __tablename__ = "esg_policies"

    title = Column(String, nullable=False)
    category = Column(String)
    body = Column(Text)
    version = Column(String, default="1.0")
    effective_date = Column(Date)
    status = Column(String, default="active")

class PolicyAcknowledgement(Base, TimestampMixin):
    __tablename__ = "policy_acknowledgements"

    policy_id = Column(Integer, ForeignKey("esg_policies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), server_default=func.now())

class Audit(Base, TimestampMixin):
    __tablename__ = "audits"

    title = Column(String, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    auditor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    date = Column(Date)
    scope = Column(String)
    result = Column(String)  # pass / fail / observations

class ComplianceIssue(Base, TimestampMixin):
    __tablename__ = "compliance_issues"

    audit_id = Column(Integer, ForeignKey("audits.id"), nullable=False)
    severity = Column(Enum(IssueSeverity), nullable=False)
    description = Column(Text, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)   # required at creation (plan §5)
    due_date = Column(Date, nullable=False)                              # required at creation (plan §5)
    status = Column(Enum(IssueStatus), default=IssueStatus.open, nullable=False)

    @property
    def is_overdue(self) -> bool:
        # computed on read, never stored (plan §3)
        return self.status != IssueStatus.resolved and self.due_date is not None and self.due_date < date.today()
