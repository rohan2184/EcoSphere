from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.services import reports as report_service
from app.services.reports import ReportFilters

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(get_current_user)],
)

MEDIA_TYPES = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


class CustomReportRequest(BaseModel):
    module: str = "summary"        # env | social | gamification | governance | summary
    department_id: int | None = None
    employee_id: int | None = None
    challenge_id: int | None = None
    category_id: int | None = None
    esg_category: str | None = None
    date_from: date | None = None
    date_to: date | None = None


def _build(db: Session, filters: ReportFilters):
    try:
        return report_service.build_report(db, filters)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/{module}")
def module_report(
    module: str,
    department_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
):
    columns, rows = _build(db, ReportFilters(
        module=module, department_id=department_id, date_from=date_from, date_to=date_to))
    return {"module": module, "columns": columns, "rows": rows, "count": len(rows)}


@router.post("/custom")
def custom_report(body: CustomReportRequest, db: Session = Depends(get_db)):
    filters = ReportFilters(**body.model_dump())
    columns, rows = _build(db, filters)
    return {"module": filters.module, "columns": columns, "rows": rows, "count": len(rows)}


@router.get("/custom/export")
def export_custom_report(
    format: str = "csv",
    module: str = "summary",
    department_id: int | None = None,
    employee_id: int | None = None,
    challenge_id: int | None = None,
    category_id: int | None = None,
    esg_category: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
):
    if format not in MEDIA_TYPES:
        raise HTTPException(400, f"Unknown format '{format}' — expected csv, xlsx or pdf")
    filters = ReportFilters(
        module=module, department_id=department_id, employee_id=employee_id,
        challenge_id=challenge_id, category_id=category_id, esg_category=esg_category,
        date_from=date_from, date_to=date_to)
    columns, rows = _build(db, filters)

    if format == "csv":
        content = report_service.to_csv(columns, rows)
    elif format == "xlsx":
        content = report_service.to_xlsx(columns, rows)
    else:
        content = report_service.to_pdf(columns, rows, f"EcoSphere {filters.module.title()} Report")

    filename = f"ecosphere_{filters.module}_report.{format}"
    return Response(
        content=content,
        media_type=MEDIA_TYPES[format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
