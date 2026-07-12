"""ESG scoring engine — plan §4.

Scores are computed on-demand from live data (never read from a stored
snapshot). Each sub-score is a pure function clamped to [0, 100]; weights
come from the Settings singleton (default 40/30/30).

Convention: a sub-score with no underlying data returns the neutral 50 so a
brand-new department doesn't rank as either perfect or failing.
"""
from datetime import date
from statistics import median
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    Settings, Department, User,
    CarbonTransaction, EnvironmentalGoal,
    EmployeeParticipation, DiversityMetric, ApprovalStatus,
    ESGPolicy, PolicyAcknowledgement, Audit, ComplianceIssue,
)
from app.models.governance import IssueStatus

NEUTRAL = 50.0


def clamp(value: float) -> float:
    return max(0.0, min(100.0, round(value, 1)))


def get_weights(db: Session) -> tuple[int, int, int]:
    s = db.query(Settings).first()
    if not s:
        return 40, 30, 30
    return s.weight_env or 40, s.weight_social or 30, s.weight_gov or 30


def _employee_count(db: Session, dept: Department) -> int:
    actual = db.query(func.count(User.id)).filter(User.department_id == dept.id).scalar() or 0
    return max(dept.employee_count or 0, actual, 1)


# ---- Environmental ----
def environmental_score(db: Session, department_id: int) -> float:
    goals = db.query(EnvironmentalGoal).filter(EnvironmentalGoal.department_id == department_id).all()
    if goals:
        met = sum(1 for g in goals if (g.current_value or 0) >= g.target_value)
        return clamp(100.0 * met / len(goals))

    # no goals → emission efficiency vs org median (median dept scores 50)
    per_dept = dict(
        db.query(CarbonTransaction.department_id, func.sum(CarbonTransaction.co2e_amount))
        .group_by(CarbonTransaction.department_id)
        .all()
    )
    dept_co2e = per_dept.get(department_id)
    if dept_co2e is None or not per_dept:
        return NEUTRAL
    org_median = median(per_dept.values())
    if org_median <= 0:
        return NEUTRAL
    return clamp(100.0 - 50.0 * dept_co2e / org_median)


# ---- Social ----
def social_score(db: Session, department_id: int) -> float:
    dept = db.get(Department, department_id)
    components: list[float] = []

    participants = (
        db.query(func.count(func.distinct(EmployeeParticipation.user_id)))
        .join(User, User.id == EmployeeParticipation.user_id)
        .filter(User.department_id == department_id,
                EmployeeParticipation.approval_status == ApprovalStatus.approved)
        .scalar() or 0
    )
    if dept:
        components.append(clamp(100.0 * participants / _employee_count(db, dept)))

    latest = (
        db.query(DiversityMetric)
        .filter(DiversityMetric.department_id == department_id)
        .order_by(DiversityMetric.period.desc())
        .first()
    )
    if latest:
        if latest.training_completion_pct is not None:
            components.append(clamp(latest.training_completion_pct))
        if latest.gender_ratio is not None:
            # 50/50 split scores 100, fully skewed scores 0
            components.append(clamp(100.0 - abs(50.0 - latest.gender_ratio) * 2))

    return clamp(sum(components) / len(components)) if components else NEUTRAL


# ---- Governance ----
def governance_score(db: Session, department_id: int) -> float:
    dept = db.get(Department, department_id)
    components: list[float] = []

    policies = db.query(func.count(ESGPolicy.id)).filter(ESGPolicy.status == "active").scalar() or 0
    if policies and dept:
        acks = (
            db.query(func.count(PolicyAcknowledgement.id))
            .join(User, User.id == PolicyAcknowledgement.user_id)
            .filter(User.department_id == department_id)
            .scalar() or 0
        )
        components.append(clamp(100.0 * acks / (policies * _employee_count(db, dept))))

    issues = (
        db.query(ComplianceIssue)
        .join(Audit, Audit.id == ComplianceIssue.audit_id)
        .filter(Audit.department_id == department_id,
                ComplianceIssue.status != IssueStatus.resolved)
        .all()
    )
    # ponytail: flat penalty — 10 per open issue, +10 more if overdue; capped by clamp
    penalty = sum(20 if i.due_date and i.due_date < date.today() else 10 for i in issues)
    components.append(clamp(100.0 - penalty))

    audits = db.query(Audit).filter(Audit.department_id == department_id, Audit.result.isnot(None)).all()
    if audits:
        passed = sum(1 for a in audits if (a.result or "").lower() == "pass")
        components.append(clamp(100.0 * passed / len(audits)))

    return clamp(sum(components) / len(components)) if components else NEUTRAL


# ---- Totals ----
def department_scores(db: Session, department: Department) -> dict:
    w_env, w_social, w_gov = get_weights(db)
    env = environmental_score(db, department.id)
    social = social_score(db, department.id)
    gov = governance_score(db, department.id)
    total_weight = (w_env + w_social + w_gov) or 100
    total = (env * w_env + social * w_social + gov * w_gov) / total_weight
    return {
        "department_id": department.id,
        "department_name": department.name,
        "employee_count": _employee_count(db, department),
        "environmental_score": env,
        "social_score": social,
        "governance_score": gov,
        "total_score": clamp(total),
    }


def all_department_scores(db: Session) -> list[dict]:
    departments = db.query(Department).order_by(Department.id).all()
    scores = [department_scores(db, d) for d in departments]
    return sorted(scores, key=lambda s: s["total_score"], reverse=True)


def overall_esg_score(db: Session) -> dict:
    scores = all_department_scores(db)
    if not scores:
        return {"overall_score": 0.0, "environmental_score": 0.0,
                "social_score": 0.0, "governance_score": 0.0, "departments": []}
    total_employees = sum(s["employee_count"] for s in scores)

    def weighted(key: str) -> float:
        return clamp(sum(s[key] * s["employee_count"] for s in scores) / total_employees)

    return {
        "overall_score": weighted("total_score"),
        "environmental_score": weighted("environmental_score"),
        "social_score": weighted("social_score"),
        "governance_score": weighted("governance_score"),
        "departments": scores,
    }
