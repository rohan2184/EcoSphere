from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.gamification import Notification
from app.routers.governance import ensure_overdue_notifications
from app.services import scoring

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(get_current_user)],
)



@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    overdue = ensure_overdue_notifications(db)
    result = scoring.overall_esg_score(db)
    w_env, w_social, w_gov = scoring.get_weights(db)
    result["weights"] = {"env": w_env, "social": w_social, "gov": w_gov}
    result["department_ranking"] = result.pop("departments")
    result["compliance_alerts"] = [
        {
            "issue_id": i.id,
            "severity": i.severity.value,
            "description": i.description,
            "owner_id": i.owner_id,
            "due_date": i.due_date.isoformat(),
        }
        for i in overdue
    ]
    result["recent_notifications"] = [
        {
            "id": n.id,
            "user_id": n.user_id,
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in db.query(Notification).order_by(Notification.created_at.desc()).limit(10).all()
    ]
    return result


@router.get("/scores")
def scores(db: Session = Depends(get_db)):
    return scoring.all_department_scores(db)
