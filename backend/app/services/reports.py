"""
Reports service — Social, Gamification, Governance and Environmental.
Exposes ReportFilters, build_report, to_csv, to_xlsx, to_pdf for the router.
"""

import csv
import io
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.auth import User


# ---------------------------------------------------------------------------
# ReportFilters — shared filter bag used by router → build_report
# ---------------------------------------------------------------------------

@dataclass
class ReportFilters:
    module: str = "summary"
    department_id: Optional[int] = None
    employee_id: Optional[int] = None
    challenge_id: Optional[int] = None
    category_id: Optional[int] = None
    esg_category: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None


# ---------------------------------------------------------------------------
# build_report — dispatches to the right sub-service
# ---------------------------------------------------------------------------

def build_report(db: Session, filters: ReportFilters) -> tuple[list[str], list[dict]]:
    """Return (column_names, rows) for the requested module."""
    m = filters.module.lower()

    if m == "social":
        data = get_social_report(
            db,
            department_id=filters.department_id,
            date_from=filters.date_from,
            date_to=filters.date_to,
            employee_id=filters.employee_id,
        )
        # Flatten top-level scalars + activity breakdown rows
        scalars = {k: v for k, v in data.items() if k != "activities"}
        rows = [{**scalars, **act} for act in data.get("activities", [])] or [scalars]
        cols = list(rows[0].keys()) if rows else []
        return cols, rows

    if m == "gamification":
        data = get_gamification_report(
            db,
            department_id=filters.department_id,
            date_from=filters.date_from,
            date_to=filters.date_to,
            employee_id=filters.employee_id,
            challenge_id=filters.challenge_id,
        )
        scalars = {k: v for k, v in data.items() if k != "challenges"}
        rows = [{**scalars, **ch} for ch in data.get("challenges", [])] or [scalars]
        cols = list(rows[0].keys()) if rows else []
        return cols, rows

    if m == "env":
        from app.services.emissions import get_environmental_report
        data = get_environmental_report(
            db,
            department_id=filters.department_id,
            date_from=filters.date_from,
            date_to=filters.date_to,
        )
        # Export the flat transaction rows for CSV; include summary as header row
        txns = data.get("transactions", [])
        if txns:
            cols = list(txns[0].keys())
            return cols, txns
        # Fallback: summary-only row
        summary = data.get("summary", {})
        return list(summary.keys()), [summary]

    if m in ("governance", "summary"):
        # Stub — governance report not yet implemented as a flat table
        return ["module", "status"], [{"module": m, "status": "no_data"}]

    raise ValueError(f"Unknown report module '{filters.module}'. Expected: env, social, gamification, governance, summary.")


# ---------------------------------------------------------------------------
# Export helpers
# ---------------------------------------------------------------------------

def to_csv(columns: list[str], rows: list[dict[str, Any]]) -> bytes:
    """Serialise rows to UTF-8 CSV bytes."""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


def to_xlsx(columns: list[str], rows: list[dict[str, Any]]) -> bytes:
    """Serialise rows to xlsx. Falls back to csv if openpyxl is unavailable."""
    try:
        import openpyxl  # type: ignore
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(columns)
        for row in rows:
            ws.append([row.get(c) for c in columns])
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()
    except ImportError:
        # Graceful degradation: return CSV with xlsx mime-type header already set by caller
        return to_csv(columns, rows)


def to_pdf(columns: list[str], rows: list[dict[str, Any]], title: str = "Report") -> bytes:
    """Serialise rows to PDF. Falls back to csv if reportlab is unavailable."""
    try:
        from reportlab.lib.pagesizes import A4  # type: ignore
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4)
        styles = getSampleStyleSheet()
        elements = [Paragraph(title, styles["Title"])]
        data = [columns] + [[str(row.get(c, "")) for c in columns] for row in rows]
        t = Table(data)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#064e3b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ]))
        elements.append(t)
        doc.build(elements)
        return buf.getvalue()
    except ImportError:
        return to_csv(columns, rows)

from app.models.social import CSRActivity, EmployeeParticipation, ApprovalStatus, DiversityMetric
from app.models.gamification import (
    Challenge,
    ChallengeParticipation,
    ChallengeStatus,
    UserBadge,
    RewardRedemption,
)


def get_social_report(
    db: Session,
    department_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    employee_id: Optional[int] = None,
) -> dict:
    # 1. Total Org-wide CSR Activities
    total_csr_activities = db.query(CSRActivity).count()

    # 2. Scope participations
    query = db.query(EmployeeParticipation).join(User, EmployeeParticipation.user_id == User.id)
    if department_id is not None:
        query = query.filter(User.department_id == department_id)
    if employee_id is not None:
        query = query.filter(EmployeeParticipation.user_id == employee_id)
    if date_from is not None:
        query = query.filter(EmployeeParticipation.completion_date >= date_from)
    if date_to is not None:
        query = query.filter(EmployeeParticipation.completion_date <= date_to)

    total_participations = query.count()
    approved_participations = query.filter(
        EmployeeParticipation.approval_status == ApprovalStatus.approved
    ).count()
    pending_participations = query.filter(
        EmployeeParticipation.approval_status == ApprovalStatus.pending
    ).count()
    rejected_participations = query.filter(
        EmployeeParticipation.approval_status == ApprovalStatus.rejected
    ).count()

    # 3. Total Points Awarded in Scope (Approved only)
    points_sum_query = db.query(
        func.sum(EmployeeParticipation.points_earned)
    ).select_from(EmployeeParticipation).join(User, EmployeeParticipation.user_id == User.id)
    if department_id is not None:
        points_sum_query = points_sum_query.filter(User.department_id == department_id)
    if employee_id is not None:
        points_sum_query = points_sum_query.filter(EmployeeParticipation.user_id == employee_id)
    if date_from is not None:
        points_sum_query = points_sum_query.filter(EmployeeParticipation.completion_date >= date_from)
    if date_to is not None:
        points_sum_query = points_sum_query.filter(EmployeeParticipation.completion_date <= date_to)
    points_sum_query = points_sum_query.filter(
        EmployeeParticipation.approval_status == ApprovalStatus.approved
    )
    total_points_awarded = points_sum_query.scalar() or 0

    # 4. Participation Rate = approved / total employees in scope
    emp_query = db.query(User).filter(User.is_active == True)  # noqa: E712
    if department_id is not None:
        emp_query = emp_query.filter(User.department_id == department_id)
    total_employees = emp_query.count()

    participation_rate = (
        float(approved_participations) / total_employees if total_employees > 0 else 0.0
    )

    # 5. Activity Breakdown
    all_activities = db.query(CSRActivity).all()
    activity_breakdown = []
    for act in all_activities:
        act_query = db.query(EmployeeParticipation).join(
            User, EmployeeParticipation.user_id == User.id
        ).filter(EmployeeParticipation.csr_activity_id == act.id)
        if department_id is not None:
            act_query = act_query.filter(User.department_id == department_id)
        if employee_id is not None:
            act_query = act_query.filter(EmployeeParticipation.user_id == employee_id)
        if date_from is not None:
            act_query = act_query.filter(EmployeeParticipation.completion_date >= date_from)
        if date_to is not None:
            act_query = act_query.filter(EmployeeParticipation.completion_date <= date_to)

        p_count = act_query.count()
        app_count = act_query.filter(
            EmployeeParticipation.approval_status == ApprovalStatus.approved
        ).count()
        app_rate = float(app_count) / p_count if p_count > 0 else 0.0

        activity_breakdown.append(
            {
                "activity_title": act.title,
                "participant_count": p_count,
                "approval_rate": app_rate,
            }
        )

    # 6. Diversity Summary
    diversity_query = db.query(DiversityMetric)
    if department_id is not None:
        diversity_query = diversity_query.filter(DiversityMetric.department_id == department_id)
    
    all_metrics = diversity_query.order_by(DiversityMetric.period.desc()).all()
    latest_by_dept = {}
    for m in all_metrics:
        if m.department_id not in latest_by_dept:
            latest_by_dept[m.department_id] = m
    
    avg_training_completion = 0.0
    avg_gender_ratio = 0.0
    valid_training = [m.training_completion_pct for m in latest_by_dept.values() if m.training_completion_pct is not None]
    valid_gender = [m.gender_ratio for m in latest_by_dept.values() if m.gender_ratio is not None]
    
    if valid_training:
        avg_training_completion = sum(valid_training) / len(valid_training)
    if valid_gender:
        avg_gender_ratio = sum(valid_gender) / len(valid_gender)

    diversity_summary = {
        "departments_reported": len(latest_by_dept),
        "average_training_completion_pct": avg_training_completion,
        "average_gender_ratio": avg_gender_ratio,
    }

    return {
        "total_csr_activities": total_csr_activities,
        "total_participations": total_participations,
        "approved_participations": approved_participations,
        "pending_participations": pending_participations,
        "rejected_participations": rejected_participations,
        "total_points_awarded": total_points_awarded,
        "participation_rate": participation_rate,
        "activities": activity_breakdown,
        "diversity_summary": diversity_summary,
    }


def get_gamification_report(
    db: Session,
    department_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    employee_id: Optional[int] = None,
    challenge_id: Optional[int] = None,
) -> dict:
    # 1. Challenge statistics
    total_challenges = db.query(Challenge).count()
    active_challenges = db.query(Challenge).filter(
        Challenge.status == ChallengeStatus.active
    ).count()
    completed_challenges = db.query(Challenge).filter(
        Challenge.status == ChallengeStatus.completed
    ).count()

    # 2. Challenge Participations in Scope
    cp_query = db.query(ChallengeParticipation).join(
        User, ChallengeParticipation.user_id == User.id
    )
    if department_id is not None:
        cp_query = cp_query.filter(User.department_id == department_id)
    if employee_id is not None:
        cp_query = cp_query.filter(ChallengeParticipation.user_id == employee_id)
    if challenge_id is not None:
        cp_query = cp_query.filter(ChallengeParticipation.challenge_id == challenge_id)
    if date_from is not None:
        cp_query = cp_query.filter(ChallengeParticipation.created_at >= date_from)
    if date_to is not None:
        cp_query = cp_query.filter(ChallengeParticipation.created_at <= date_to)

    total_participations = cp_query.count()

    # 3. XP Awarded in Scope (Approved only)
    xp_query = db.query(func.sum(ChallengeParticipation.xp_awarded)).select_from(
        ChallengeParticipation
    ).join(User, ChallengeParticipation.user_id == User.id)
    if department_id is not None:
        xp_query = xp_query.filter(User.department_id == department_id)
    if employee_id is not None:
        xp_query = xp_query.filter(ChallengeParticipation.user_id == employee_id)
    if challenge_id is not None:
        xp_query = xp_query.filter(ChallengeParticipation.challenge_id == challenge_id)
    if date_from is not None:
        xp_query = xp_query.filter(ChallengeParticipation.created_at >= date_from)
    if date_to is not None:
        xp_query = xp_query.filter(ChallengeParticipation.created_at <= date_to)
    xp_query = xp_query.filter(
        ChallengeParticipation.approval_status == ApprovalStatus.approved
    )
    total_xp_awarded = xp_query.scalar() or 0

    # 4. Badges Unlocked in Scope
    badge_query = db.query(UserBadge).join(User, UserBadge.user_id == User.id)
    if department_id is not None:
        badge_query = badge_query.filter(User.department_id == department_id)
    if employee_id is not None:
        badge_query = badge_query.filter(UserBadge.user_id == employee_id)
    if date_from is not None:
        badge_query = badge_query.filter(UserBadge.awarded_at >= date_from)
    if date_to is not None:
        badge_query = badge_query.filter(UserBadge.awarded_at <= date_to)
    total_badges_unlocked = badge_query.count()

    # 5. Reward Redemptions in Scope
    redemption_query = db.query(RewardRedemption).join(
        User, RewardRedemption.user_id == User.id
    )
    if department_id is not None:
        redemption_query = redemption_query.filter(User.department_id == department_id)
    if employee_id is not None:
        redemption_query = redemption_query.filter(RewardRedemption.user_id == employee_id)
    if date_from is not None:
        redemption_query = redemption_query.filter(RewardRedemption.redeemed_at >= date_from)
    if date_to is not None:
        redemption_query = redemption_query.filter(RewardRedemption.redeemed_at <= date_to)
    total_rewards_redeemed = redemption_query.count()

    # 6. Points Spent on Rewards
    points_spent_query = db.query(
        func.sum(RewardRedemption.points_spent)
    ).select_from(RewardRedemption).join(User, RewardRedemption.user_id == User.id)
    if department_id is not None:
        points_spent_query = points_spent_query.filter(User.department_id == department_id)
    if employee_id is not None:
        points_spent_query = points_spent_query.filter(RewardRedemption.user_id == employee_id)
    if date_from is not None:
        points_spent_query = points_spent_query.filter(RewardRedemption.redeemed_at >= date_from)
    if date_to is not None:
        points_spent_query = points_spent_query.filter(RewardRedemption.redeemed_at <= date_to)
    total_points_spent_on_rewards = points_spent_query.scalar() or 0

    # 7. Challenge Breakdown
    all_challenges = db.query(Challenge)
    if challenge_id is not None:
        all_challenges = all_challenges.filter(Challenge.id == challenge_id)
    all_challenges = all_challenges.all()

    challenge_breakdown = []
    for ch in all_challenges:
        ch_query = db.query(ChallengeParticipation).join(
            User, ChallengeParticipation.user_id == User.id
        ).filter(ChallengeParticipation.challenge_id == ch.id)
        if department_id is not None:
            ch_query = ch_query.filter(User.department_id == department_id)
        if employee_id is not None:
            ch_query = ch_query.filter(ChallengeParticipation.user_id == employee_id)
        if date_from is not None:
            ch_query = ch_query.filter(ChallengeParticipation.created_at >= date_from)
        if date_to is not None:
            ch_query = ch_query.filter(ChallengeParticipation.created_at <= date_to)

        p_count = ch_query.count()
        comp_count = ch_query.filter(ChallengeParticipation.progress == 100).count()
        comp_rate = float(comp_count) / p_count if p_count > 0 else 0.0

        avg_prog_query = db.query(func.avg(ChallengeParticipation.progress)).select_from(
            ChallengeParticipation
        ).join(User, ChallengeParticipation.user_id == User.id).filter(
            ChallengeParticipation.challenge_id == ch.id
        )
        if department_id is not None:
            avg_prog_query = avg_prog_query.filter(User.department_id == department_id)
        if employee_id is not None:
            avg_prog_query = avg_prog_query.filter(ChallengeParticipation.user_id == employee_id)
        if date_from is not None:
            avg_prog_query = avg_prog_query.filter(ChallengeParticipation.created_at >= date_from)
        if date_to is not None:
            avg_prog_query = avg_prog_query.filter(ChallengeParticipation.created_at <= date_to)

        avg_prog = avg_prog_query.scalar() or 0.0

        challenge_breakdown.append(
            {
                "title": ch.title,
                "participant_count": p_count,
                "completion_rate": comp_rate,
                "avg_progress": float(avg_prog),
            }
        )

    return {
        "total_challenges": total_challenges,
        "active_challenges": active_challenges,
        "completed_challenges": completed_challenges,
        "total_participations": total_participations,
        "total_xp_awarded": total_xp_awarded,
        "total_badges_unlocked": total_badges_unlocked,
        "total_rewards_redeemed": total_rewards_redeemed,
        "total_points_spent_on_rewards": total_points_spent_on_rewards,
        "challenges": challenge_breakdown,
    }
