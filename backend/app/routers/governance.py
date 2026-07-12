from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models import User, ESGPolicy, PolicyAcknowledgement, Audit, ComplianceIssue
from app.models.gamification import Notification
from app.models.governance import IssueStatus
from app.schemas.governance import (
    PolicyCreate, PolicyUpdate, PolicyOut, AcknowledgementOut,
    AuditCreate, AuditUpdate, AuditOut,
    ComplianceIssueCreate, ComplianceIssueUpdate, ComplianceIssueOut,
)

# All reads require login; mutations additionally require admin/manager below.
router = APIRouter(
    prefix="/governance",
    tags=["governance"],
    dependencies=[Depends(get_current_user)],
)

require_manager = require_role("admin", "manager")


def get_or_404(db: Session, model, item_id: int):
    obj = db.get(model, item_id)
    if not obj:
        raise HTTPException(404, f"{model.__name__} {item_id} not found")
    return obj


def ensure_overdue_notifications(db: Session) -> list[ComplianceIssue]:
    """Flag past-due open issues and notify owners (once per issue). Plan §5."""
    overdue = (
        db.query(ComplianceIssue)
        .filter(ComplianceIssue.status != IssueStatus.resolved, ComplianceIssue.due_date < date.today())
        .all()
    )
    for issue in overdue:
        title = f"Compliance issue #{issue.id} is overdue"
        exists = (
            db.query(Notification)
            .filter(Notification.user_id == issue.owner_id,
                    Notification.type == "compliance_overdue",
                    Notification.title == title)
            .first()
        )
        if not exists:
            db.add(Notification(
                user_id=issue.owner_id, type="compliance_overdue", title=title,
                message=f"{issue.severity.value} severity issue was due {issue.due_date.isoformat()}: {issue.description[:120]}",
            ))
    db.commit()
    return overdue


# ---- Policies ----
@router.get("/policies", response_model=list[PolicyOut])
def list_policies(status: str | None = None, db: Session = Depends(get_db)):
    q = db.query(ESGPolicy)
    if status:
        q = q.filter(ESGPolicy.status == status)
    return q.order_by(ESGPolicy.id).all()

@router.post("/policies", response_model=PolicyOut, status_code=201)
def create_policy(body: PolicyCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_manager)):
    policy = ESGPolicy(**body.model_dump())
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy

@router.get("/policies/{policy_id}", response_model=PolicyOut)
def get_policy(policy_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, ESGPolicy, policy_id)

@router.put("/policies/{policy_id}", response_model=PolicyOut)
def update_policy(policy_id: int, body: PolicyUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_manager)):
    policy = get_or_404(db, ESGPolicy, policy_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(policy, k, v)
    db.commit()
    db.refresh(policy)
    return policy

@router.delete("/policies/{policy_id}", status_code=204)
def delete_policy(policy_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_manager)):
    policy = get_or_404(db, ESGPolicy, policy_id)
    db.query(PolicyAcknowledgement).filter(PolicyAcknowledgement.policy_id == policy_id).delete()
    db.delete(policy)
    db.commit()

@router.post("/policies/{policy_id}/acknowledge", response_model=AcknowledgementOut, status_code=201)
def acknowledge_policy(policy_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    get_or_404(db, ESGPolicy, policy_id)
    user_id = current_user.id
    existing = (
        db.query(PolicyAcknowledgement)
        .filter_by(policy_id=policy_id, user_id=user_id)
        .first()
    )
    if existing:  # idempotent — acknowledging twice is a no-op
        return existing
    ack = PolicyAcknowledgement(policy_id=policy_id, user_id=user_id)
    db.add(ack)
    db.commit()
    db.refresh(ack)
    return ack

@router.get("/policies/{policy_id}/acknowledgements", response_model=list[AcknowledgementOut])
def list_acknowledgements(policy_id: int, db: Session = Depends(get_db)):
    get_or_404(db, ESGPolicy, policy_id)
    return db.query(PolicyAcknowledgement).filter_by(policy_id=policy_id).all()


# ---- Audits ----
@router.get("/audits", response_model=list[AuditOut])
def list_audits(department_id: int | None = None, result: str | None = None, status: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Audit)
    if department_id:
        q = q.filter(Audit.department_id == department_id)
    if result:
        q = q.filter(Audit.result == result)
    if status:
        q = q.filter(Audit.status == status)
    return q.order_by(Audit.id).all()

@router.post("/audits", response_model=AuditOut, status_code=201)
def create_audit(body: AuditCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_manager)):
    audit = Audit(**body.model_dump())
    db.add(audit)
    db.commit()
    db.refresh(audit)
    return audit

@router.get("/audits/{audit_id}", response_model=AuditOut)
def get_audit(audit_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, Audit, audit_id)

@router.put("/audits/{audit_id}", response_model=AuditOut)
def update_audit(audit_id: int, body: AuditUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_manager)):
    audit = get_or_404(db, Audit, audit_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(audit, k, v)
    db.commit()
    db.refresh(audit)
    return audit

@router.delete("/audits/{audit_id}", status_code=204)
def delete_audit(audit_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_manager)):
    audit = get_or_404(db, Audit, audit_id)
    if db.query(ComplianceIssue).filter(ComplianceIssue.audit_id == audit_id).count():
        raise HTTPException(400, "Audit has compliance issues; resolve/delete them first")
    db.delete(audit)
    db.commit()


@router.get("/compliance-issues", response_model=list[ComplianceIssueOut])
def list_compliance_issues(
    status: IssueStatus | None = None,
    overdue: bool | None = None,
    audit_id: int | None = None,
    owner_id: int | None = None,
    db: Session = Depends(get_db),
):
    ensure_overdue_notifications(db)
    q = db.query(ComplianceIssue)
    if status:
        q = q.filter(ComplianceIssue.status == status)
    if audit_id:
        q = q.filter(ComplianceIssue.audit_id == audit_id)
    if owner_id:
        q = q.filter(ComplianceIssue.owner_id == owner_id)
    issues = q.order_by(ComplianceIssue.due_date).all()
    if overdue is not None:
        issues = [i for i in issues if i.is_overdue == overdue]
    return issues

@router.post("/compliance-issues", response_model=ComplianceIssueOut, status_code=201)
def create_compliance_issue(body: ComplianceIssueCreate, db: Session = Depends(get_db), current_user: dict = Depends(require_manager)):
    get_or_404(db, Audit, body.audit_id)
    get_or_404(db, User, body.owner_id)
    issue = ComplianceIssue(**body.model_dump())
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue

@router.get("/compliance-issues/{issue_id}", response_model=ComplianceIssueOut)
def get_compliance_issue(issue_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, ComplianceIssue, issue_id)

@router.put("/compliance-issues/{issue_id}", response_model=ComplianceIssueOut)
def update_compliance_issue(issue_id: int, body: ComplianceIssueUpdate, db: Session = Depends(get_db), current_user: dict = Depends(require_manager)):
    issue = get_or_404(db, ComplianceIssue, issue_id)
    data = body.model_dump(exclude_unset=True)
    if "owner_id" in data:
        get_or_404(db, User, data["owner_id"])
    for k, v in data.items():
        setattr(issue, k, v)
    db.commit()
    db.refresh(issue)
    return issue

@router.delete("/compliance-issues/{issue_id}", status_code=204)
def delete_compliance_issue(issue_id: int, db: Session = Depends(get_db), current_user: dict = Depends(require_manager)):
    issue = get_or_404(db, ComplianceIssue, issue_id)
    db.delete(issue)
    db.commit()
