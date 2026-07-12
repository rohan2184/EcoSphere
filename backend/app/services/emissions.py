from datetime import date, timedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.env import EmissionFactor, CarbonTransaction, EnvironmentalGoal
from app.models.core import Settings, Department
from app.schemas.env import CarbonTransactionCreate


def calculate_emission(quantity: float, emission_factor: EmissionFactor) -> float:
    """CO2e = quantity * factor_value (kg CO2e per unit)."""
    return quantity * emission_factor.factor_value


def create_carbon_transaction(
    db: Session,
    data: CarbonTransactionCreate,
    auto_generated: bool = False,
) -> CarbonTransaction:
    """Create a CarbonTransaction.

    If Settings.auto_emission_calc is True, always look up the EmissionFactor
    and (re)compute co2e_amount server-side, ignoring any client-supplied value.
    If False, trust the co2e_amount provided in the request (manual entry).
    """
    settings = db.query(Settings).first()
    auto_calc = bool(settings and settings.auto_emission_calc)

    payload = data.model_dump()

    if auto_calc:
        emission_factor = (
            db.query(EmissionFactor)
            .filter(EmissionFactor.id == data.emission_factor_id)
            .first()
        )
        if not emission_factor:
            raise HTTPException(status_code=404, detail="Emission factor not found")
        payload["co2e_amount"] = calculate_emission(data.quantity, emission_factor)

    txn = CarbonTransaction(**payload, auto_generated=auto_generated)
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


# ---------------------------------------------------------------------------
# Dashboard aggregations
# ---------------------------------------------------------------------------
DEFAULT_TREND_DAYS = 60


def _resolve_range(date_from, date_to):
    """Default to the last 60 days when a bound is missing."""
    if date_to is None:
        date_to = date.today()
    if date_from is None:
        date_from = date_to - timedelta(days=DEFAULT_TREND_DAYS)
    return date_from, date_to


def get_emissions_trend(db, date_from=None, date_to=None, department_id=None):
    """Total CO2e over time, ready for a line chart.

    Grouped by day when the range is short (< 14 days), otherwise by week
    (each bucket keyed by the Monday of that ISO week). Returns a list of
    {"period": "YYYY-MM-DD", "total_co2e": float} sorted ascending by period.
    """
    date_from, date_to = _resolve_range(date_from, date_to)

    query = db.query(CarbonTransaction).filter(
        CarbonTransaction.date >= date_from,
        CarbonTransaction.date <= date_to,
    )
    if department_id is not None:
        query = query.filter(CarbonTransaction.department_id == department_id)

    group_by_day = (date_to - date_from).days < 14

    buckets: dict[date, float] = {}
    for txn in query.all():
        if group_by_day:
            key = txn.date
        else:
            # Monday of the transaction's ISO week.
            key = txn.date - timedelta(days=txn.date.weekday())
        buckets[key] = buckets.get(key, 0.0) + (txn.co2e_amount or 0.0)

    return [
        {"period": key.isoformat(), "total_co2e": round(total, 2)}
        for key, total in sorted(buckets.items())
    ]


def get_department_breakdown(db, date_from=None, date_to=None):
    """Total CO2e per department in range, sorted descending by total."""
    date_from, date_to = _resolve_range(date_from, date_to)

    txns = (
        db.query(CarbonTransaction)
        .filter(
            CarbonTransaction.date >= date_from,
            CarbonTransaction.date <= date_to,
        )
        .all()
    )

    totals: dict[int, float] = {}
    for txn in txns:
        totals[txn.department_id] = totals.get(txn.department_id, 0.0) + (txn.co2e_amount or 0.0)

    # Resolve department names in one query.
    names = {d.id: d.name for d in db.query(Department).all()}

    breakdown = [
        {
            "department_id": dept_id,
            "department_name": names.get(dept_id),
            "total_co2e": round(total, 2),
        }
        for dept_id, total in totals.items()
    ]
    breakdown.sort(key=lambda row: row["total_co2e"], reverse=True)
    return breakdown


def get_goals_progress(db, department_id=None):
    """Goals annotated with progress_pct (0-100) and a computed status.

    Status precedence:
      - "achieved"  if the goal is already marked achieved
      - "overdue"   if the deadline has passed and it isn't achieved
      - "at_risk"   if within 14 days of the deadline and progress_pct < 80
      - "on_track"  otherwise (deadline still in the future)
    """
    query = db.query(EnvironmentalGoal)
    if department_id is not None:
        query = query.filter(EnvironmentalGoal.department_id == department_id)

    today = date.today()
    results = []
    for goal in query.all():
        target = goal.target_value or 0.0
        current = goal.current_value or 0.0
        if target > 0:
            progress_pct = max(0.0, min(100.0, current / target * 100))
        else:
            progress_pct = 0.0

        if (goal.status or "").lower() == "achieved":
            status = "achieved"
        elif goal.deadline is not None and goal.deadline < today:
            status = "overdue"
        elif (
            goal.deadline is not None
            and goal.deadline - today <= timedelta(days=14)
            and progress_pct < 80
        ):
            status = "at_risk"
        else:
            status = "on_track"

        results.append({
            "id": goal.id,
            "department_id": goal.department_id,
            "metric": goal.metric,
            "target_value": goal.target_value,
            "current_value": goal.current_value,
            "deadline": goal.deadline.isoformat() if goal.deadline else None,
            "progress_pct": round(progress_pct, 1),
            "status": status,
        })
    return results


def get_environmental_report(db, department_id=None, date_from=None, date_to=None):
    """Full environmental report for the given filters.

    Bundles summary stats, source-type and department breakdowns, the trend,
    goal progress, and the raw (joined) transaction rows for CSV export.
    """
    date_from, date_to = _resolve_range(date_from, date_to)

    # Filtered transaction set drives summary / by_source_type / transactions.
    query = db.query(CarbonTransaction).filter(
        CarbonTransaction.date >= date_from,
        CarbonTransaction.date <= date_to,
    )
    if department_id is not None:
        query = query.filter(CarbonTransaction.department_id == department_id)
    txns = query.order_by(CarbonTransaction.date).all()

    # Lookup tables for joined names.
    dept_names = {d.id: d.name for d in db.query(Department).all()}
    factor_names = {f.id: f.name for f in db.query(EmissionFactor).all()}

    # Summary
    total_co2e = sum(t.co2e_amount or 0.0 for t in txns)
    total_transactions = len(txns)
    avg = total_co2e / total_transactions if total_transactions else 0.0

    # By source type
    source_totals: dict[str, float] = {}
    for t in txns:
        key = t.source_type.value if hasattr(t.source_type, "value") else str(t.source_type)
        source_totals[key] = source_totals.get(key, 0.0) + (t.co2e_amount or 0.0)
    by_source_type = [
        {"source_type": key, "total_co2e": round(total, 2)}
        for key, total in sorted(source_totals.items(), key=lambda kv: kv[1], reverse=True)
    ]

    # By department (reuse breakdown helper; narrow to the filter if given).
    by_department = get_department_breakdown(db, date_from, date_to)
    if department_id is not None:
        by_department = [row for row in by_department if row["department_id"] == department_id]

    # Raw rows for CSV export, with joined names.
    transactions = [
        {
            "id": t.id,
            "date": t.date.isoformat() if t.date else None,
            "department_id": t.department_id,
            "department_name": dept_names.get(t.department_id),
            "source_type": t.source_type.value if hasattr(t.source_type, "value") else str(t.source_type),
            "source_ref": t.source_ref,
            "quantity": t.quantity,
            "emission_factor_id": t.emission_factor_id,
            "emission_factor_name": factor_names.get(t.emission_factor_id),
            "co2e_amount": t.co2e_amount,
            "auto_generated": t.auto_generated,
        }
        for t in txns
    ]

    return {
        "summary": {
            "total_co2e": round(total_co2e, 2),
            "total_transactions": total_transactions,
            "avg_co2e_per_transaction": round(avg, 2),
        },
        "by_source_type": by_source_type,
        "by_department": by_department,
        "trend": get_emissions_trend(db, date_from, date_to, department_id),
        "goals": get_goals_progress(db, department_id),
        "transactions": transactions,
    }
