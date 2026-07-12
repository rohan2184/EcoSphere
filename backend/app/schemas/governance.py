from datetime import date, datetime
from datetime import date as date_type  # for fields literally named "date"
from pydantic import BaseModel, ConfigDict
from app.models.governance import IssueSeverity, IssueStatus


class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- Policies ----
class PolicyCreate(BaseModel):
    title: str
    category: str | None = None
    body: str | None = None
    version: str = "1.0"
    effective_date: date | None = None
    status: str = "active"

class PolicyUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    body: str | None = None
    version: str | None = None
    effective_date: date | None = None
    status: str | None = None

class PolicyOut(OrmBase):
    id: int
    title: str
    category: str | None
    body: str | None
    version: str | None
    effective_date: date | None
    status: str | None
    created_at: datetime | None


class AcknowledgeIn(BaseModel):
    # TODO(auth): derive from get_current_user once Person A lands JWT deps
    user_id: int

class AcknowledgementOut(OrmBase):
    id: int
    policy_id: int
    user_id: int
    acknowledged_at: datetime | None


# ---- Audits ----
class AuditCreate(BaseModel):
    title: str
    department_id: int | None = None
    auditor_id: int | None = None
    date: date_type | None = None
    scope: str | None = None
    result: str | None = None

class AuditUpdate(BaseModel):
    title: str | None = None
    department_id: int | None = None
    auditor_id: int | None = None
    date: date_type | None = None
    scope: str | None = None
    result: str | None = None

class AuditOut(OrmBase):
    id: int
    title: str
    department_id: int | None
    auditor_id: int | None
    date: date_type | None
    scope: str | None
    result: str | None
    created_at: datetime | None


# ---- Compliance Issues ----
class ComplianceIssueCreate(BaseModel):
    audit_id: int
    severity: IssueSeverity
    description: str
    owner_id: int          # required at creation (plan §5)
    due_date: date         # required at creation (plan §5)
    status: IssueStatus = IssueStatus.open

class ComplianceIssueUpdate(BaseModel):
    severity: IssueSeverity | None = None
    description: str | None = None
    owner_id: int | None = None
    due_date: date | None = None
    status: IssueStatus | None = None

class ComplianceIssueOut(OrmBase):
    id: int
    audit_id: int
    severity: IssueSeverity
    description: str
    owner_id: int
    due_date: date
    status: IssueStatus
    is_overdue: bool
    created_at: datetime | None
