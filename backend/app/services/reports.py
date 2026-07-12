"""Report dataset builders + CSV/Excel/PDF exporters (plan §8, PDF brief §7).

Every builder returns (columns, rows) where rows are plain dicts keyed by the
columns — one shape feeds the JSON response and all three export formats.
"""
import csv
import io
from datetime import date

from sqlalchemy.orm import Session

from app.models import (
    Department, User, Category,
    CarbonTransaction, EnvironmentalGoal, EmissionFactor,
    CSRActivity, EmployeeParticipation, DiversityMetric,
    Challenge, ChallengeParticipation,
    ESGPolicy, PolicyAcknowledgement, Audit, ComplianceIssue,
)
from app.services import scoring


class ReportFilters:
    def __init__(self, module: str = "summary", department_id: int | None = None,
                 employee_id: int | None = None, challenge_id: int | None = None,
                 category_id: int | None = None, esg_category: str | None = None,
                 date_from: date | None = None, date_to: date | None = None):
        # esg_category (E/S/G) is an alias for module, per the brief's filter list
        aliases = {"e": "env", "environmental": "env", "s": "social",
                   "g": "governance", "governance": "governance", "social": "social"}
        if esg_category and module == "summary":
            module = aliases.get(esg_category.lower(), module)
        self.module = module
        self.department_id = department_id
        self.employee_id = employee_id
        self.challenge_id = challenge_id
        self.category_id = category_id
        self.date_from = date_from
        self.date_to = date_to


def _date_range(q, column, f: ReportFilters):
    if f.date_from:
        q = q.filter(column >= f.date_from)
    if f.date_to:
        q = q.filter(column <= f.date_to)
    return q


def _env_rows(db: Session, f: ReportFilters):
    q = (
        db.query(CarbonTransaction, Department.name, EmissionFactor.name)
        .join(Department, Department.id == CarbonTransaction.department_id)
        .outerjoin(EmissionFactor, EmissionFactor.id == CarbonTransaction.emission_factor_id)
    )
    if f.department_id:
        q = q.filter(CarbonTransaction.department_id == f.department_id)
    q = _date_range(q, CarbonTransaction.date, f)
    columns = ["id", "date", "department", "source_type", "source_ref",
               "quantity", "emission_factor", "co2e_kg", "auto_generated"]
    rows = [
        {"id": t.id, "date": t.date.isoformat(), "department": dept,
         "source_type": t.source_type.value, "source_ref": t.source_ref,
         "quantity": t.quantity, "emission_factor": factor,
         "co2e_kg": t.co2e_amount, "auto_generated": t.auto_generated}
        for t, dept, factor in q.order_by(CarbonTransaction.date).all()
    ]
    return columns, rows


def _social_rows(db: Session, f: ReportFilters):
    q = (
        db.query(EmployeeParticipation, User.name, Department.name, CSRActivity.title)
        .join(User, User.id == EmployeeParticipation.user_id)
        .outerjoin(Department, Department.id == User.department_id)
        .join(CSRActivity, CSRActivity.id == EmployeeParticipation.csr_activity_id)
    )
    if f.department_id:
        q = q.filter(User.department_id == f.department_id)
    if f.employee_id:
        q = q.filter(EmployeeParticipation.user_id == f.employee_id)
    if f.category_id:
        q = q.filter(CSRActivity.category_id == f.category_id)
    q = _date_range(q, EmployeeParticipation.completion_date, f)
    columns = ["id", "employee", "department", "activity", "approval_status",
               "points_earned", "completion_date"]
    rows = [
        {"id": p.id, "employee": user, "department": dept, "activity": activity,
         "approval_status": p.approval_status.value, "points_earned": p.points_earned,
         "completion_date": p.completion_date.isoformat() if p.completion_date else None}
        for p, user, dept, activity in q.order_by(EmployeeParticipation.id).all()
    ]
    return columns, rows


def _gamification_rows(db: Session, f: ReportFilters):
    q = (
        db.query(ChallengeParticipation, User.name, Department.name, Challenge.title)
        .join(User, User.id == ChallengeParticipation.user_id)
        .outerjoin(Department, Department.id == User.department_id)
        .join(Challenge, Challenge.id == ChallengeParticipation.challenge_id)
    )
    if f.department_id:
        q = q.filter(User.department_id == f.department_id)
    if f.employee_id:
        q = q.filter(ChallengeParticipation.user_id == f.employee_id)
    if f.challenge_id:
        q = q.filter(ChallengeParticipation.challenge_id == f.challenge_id)
    columns = ["id", "employee", "department", "challenge", "progress_pct",
               "approval_status", "xp_awarded"]
    rows = [
        {"id": p.id, "employee": user, "department": dept, "challenge": challenge,
         "progress_pct": p.progress, "approval_status": p.approval_status.value,
         "xp_awarded": p.xp_awarded}
        for p, user, dept, challenge in q.order_by(ChallengeParticipation.id).all()
    ]
    return columns, rows


def _governance_rows(db: Session, f: ReportFilters):
    q = (
        db.query(ComplianceIssue, Audit.title, Department.name, User.name)
        .join(Audit, Audit.id == ComplianceIssue.audit_id)
        .outerjoin(Department, Department.id == Audit.department_id)
        .join(User, User.id == ComplianceIssue.owner_id)
    )
    if f.department_id:
        q = q.filter(Audit.department_id == f.department_id)
    if f.employee_id:
        q = q.filter(ComplianceIssue.owner_id == f.employee_id)
    q = _date_range(q, ComplianceIssue.due_date, f)
    columns = ["id", "audit", "department", "severity", "description", "owner",
               "due_date", "status", "is_overdue"]
    rows = [
        {"id": i.id, "audit": audit, "department": dept, "severity": i.severity.value,
         "description": i.description, "owner": owner, "due_date": i.due_date.isoformat(),
         "status": i.status.value, "is_overdue": i.is_overdue}
        for i, audit, dept, owner in q.order_by(ComplianceIssue.due_date).all()
    ]
    return columns, rows


def _summary_rows(db: Session, f: ReportFilters):
    scores = scoring.all_department_scores(db)
    if f.department_id:
        scores = [s for s in scores if s["department_id"] == f.department_id]
    columns = ["department_id", "department_name", "employee_count",
               "environmental_score", "social_score", "governance_score", "total_score"]
    return columns, scores


BUILDERS = {
    "env": _env_rows,
    "social": _social_rows,
    "gamification": _gamification_rows,
    "governance": _governance_rows,
    "summary": _summary_rows,
}


def build_report(db: Session, f: ReportFilters):
    builder = BUILDERS.get(f.module)
    if not builder:
        raise ValueError(f"Unknown module '{f.module}' — expected one of {sorted(BUILDERS)}")
    return builder(db, f)


# ---- exporters ----
def to_csv(columns: list[str], rows: list[dict]) -> bytes:
    buf = io.StringIO(newline="")
    writer = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    # utf-8-sig so Excel on Windows opens it with correct encoding
    return buf.getvalue().encode("utf-8-sig")


def to_xlsx(columns: list[str], rows: list[dict]) -> bytes:
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Report"
    ws.append(columns)
    for row in rows:
        ws.append([_cell(row.get(c)) for c in columns])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def to_pdf(columns: list[str], rows: list[dict], title: str) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape, letter
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(letter),
                            leftMargin=0.5 * inch, rightMargin=0.5 * inch)
    styles = getSampleStyleSheet()
    data = [columns] + [[str(_cell(r.get(c)) if _cell(r.get(c)) is not None else "") for c in columns] for r in rows]
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#166534")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0fdf4")]),
    ]))
    doc.build([Paragraph(title, styles["Title"]), Spacer(1, 12), table])
    return buf.getvalue()


def _cell(value):
    if isinstance(value, bool):
        return "yes" if value else "no"
    return value
