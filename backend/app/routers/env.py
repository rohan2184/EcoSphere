from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.auth import User
from app.models.core import Department
from app.models.env import (
    EmissionFactor, ProductESGProfile, CarbonTransaction, EnvironmentalGoal,
    OperationRecord,
)
from app.schemas.env import (
    EmissionFactorCreate, EmissionFactorUpdate, EmissionFactorOut,
    ProductESGProfileCreate, ProductESGProfileUpdate, ProductESGProfileOut,
    CarbonTransactionCreate, CarbonTransactionOut,
    EnvironmentalGoalCreate, EnvironmentalGoalUpdate, EnvironmentalGoalOut,
    OperationRecordCreate, OperationRecordUpdate, OperationRecordOut,
    OperationRecordWithTransaction,
)
from app.services.emissions import (
    create_carbon_transaction,
    create_operation_record,
    resolve_emission_factor,
    get_emissions_trend,
    get_department_breakdown,
    get_goals_progress,
    get_environmental_report,
)

router = APIRouter(prefix="/env", tags=["env"])


# Report
@router.get("/report")
def get_report(
    department_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_environmental_report(db, department_id, date_from, date_to)


# Dashboard
@router.get("/dashboard")
def get_dashboard(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trend = get_emissions_trend(db, date_from, date_to, department_id)
    total_co2e = round(sum(point["total_co2e"] for point in trend), 2)
    return {
        "total_co2e": total_co2e,
        "emissions_trend": trend,
        "department_breakdown": get_department_breakdown(db, date_from, date_to),
        "goals_progress": get_goals_progress(db, department_id),
    }


# Emission Factors
@router.get("/emission-factors", response_model=List[EmissionFactorOut])
def list_emission_factors(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(EmissionFactor).all()


@router.post("/emission-factors", response_model=EmissionFactorOut)
def create_emission_factor(factor_in: EmissionFactorCreate, db: Session = Depends(get_db), user: User = Depends(require_role("admin", "manager"))):
    factor = EmissionFactor(**factor_in.model_dump())
    db.add(factor)
    db.commit()
    db.refresh(factor)
    return factor


@router.get("/emission-factors/{id}", response_model=EmissionFactorOut)
def get_emission_factor(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    factor = db.query(EmissionFactor).filter(EmissionFactor.id == id).first()
    if not factor:
        raise HTTPException(status_code=404, detail="Emission factor not found")
    return factor


@router.put("/emission-factors/{id}", response_model=EmissionFactorOut)
def update_emission_factor(id: int, factor_in: EmissionFactorUpdate, db: Session = Depends(get_db), user: User = Depends(require_role("admin", "manager"))):
    factor = db.query(EmissionFactor).filter(EmissionFactor.id == id).first()
    if not factor:
        raise HTTPException(status_code=404, detail="Emission factor not found")
    for field, value in factor_in.model_dump(exclude_unset=True).items():
        setattr(factor, field, value)
    db.commit()
    db.refresh(factor)
    return factor


@router.delete("/emission-factors/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_emission_factor(id: int, db: Session = Depends(get_db), user: User = Depends(require_role("admin", "manager"))):
    factor = db.query(EmissionFactor).filter(EmissionFactor.id == id).first()
    if not factor:
        raise HTTPException(status_code=404, detail="Emission factor not found")
    db.delete(factor)
    db.commit()


# Products (ProductESGProfile)
@router.get("/products", response_model=List[ProductESGProfileOut])
def list_products(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ProductESGProfile).all()


@router.post("/products", response_model=ProductESGProfileOut)
def create_product(product_in: ProductESGProfileCreate, db: Session = Depends(get_db), user: User = Depends(require_role("admin", "manager"))):
    product = ProductESGProfile(**product_in.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/products/{id}", response_model=ProductESGProfileOut)
def get_product(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    product = db.query(ProductESGProfile).filter(ProductESGProfile.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.put("/products/{id}", response_model=ProductESGProfileOut)
def update_product(id: int, product_in: ProductESGProfileUpdate, db: Session = Depends(get_db), user: User = Depends(require_role("admin", "manager"))):
    product = db.query(ProductESGProfile).filter(ProductESGProfile.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in product_in.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(id: int, db: Session = Depends(get_db), user: User = Depends(require_role("admin", "manager"))):
    product = db.query(ProductESGProfile).filter(ProductESGProfile.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()


# Carbon Transactions
@router.get("/carbon-transactions", response_model=List[CarbonTransactionOut])
def list_carbon_transactions(
    department_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(CarbonTransaction)
    if department_id is not None:
        query = query.filter(CarbonTransaction.department_id == department_id)
    if date_from is not None:
        query = query.filter(CarbonTransaction.date >= date_from)
    if date_to is not None:
        query = query.filter(CarbonTransaction.date <= date_to)
    return query.all()


@router.post("/carbon-transactions", response_model=CarbonTransactionOut)
def post_carbon_transaction(txn_in: CarbonTransactionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    factor = db.query(EmissionFactor).filter(EmissionFactor.id == txn_in.emission_factor_id).first()
    if not factor:
        raise HTTPException(status_code=404, detail="Emission factor not found")
    return create_carbon_transaction(db, txn_in)


# Environmental Goals
@router.get("/goals", response_model=List[EnvironmentalGoalOut])
def list_goals(department_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(EnvironmentalGoal)
    if department_id is not None:
        query = query.filter(EnvironmentalGoal.department_id == department_id)
    return query.all()


@router.post("/goals", response_model=EnvironmentalGoalOut)
def create_goal(goal_in: EnvironmentalGoalCreate, db: Session = Depends(get_db), user: User = Depends(require_role("admin", "manager"))):
    goal = EnvironmentalGoal(**goal_in.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.get("/goals/{id}", response_model=EnvironmentalGoalOut)
def get_goal(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = db.query(EnvironmentalGoal).filter(EnvironmentalGoal.id == id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.put("/goals/{id}", response_model=EnvironmentalGoalOut)
def update_goal(id: int, goal_in: EnvironmentalGoalUpdate, db: Session = Depends(get_db), user: User = Depends(require_role("admin", "manager"))):
    goal = db.query(EnvironmentalGoal).filter(EnvironmentalGoal.id == id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    for field, value in goal_in.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/goals/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(id: int, db: Session = Depends(get_db), user: User = Depends(require_role("admin", "manager"))):
    goal = db.query(EnvironmentalGoal).filter(EnvironmentalGoal.id == id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(goal)
    db.commit()


# ── Operation Records ─────────────────────────────────────────────────────

@router.get("/operations", response_model=List[OperationRecordOut])
def list_operations(
    department_id: Optional[int] = None,
    op_type: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List operation records with optional filters."""
    from app.models.env import SourceType as ST
    query = db.query(OperationRecord)
    if department_id is not None:
        query = query.filter(OperationRecord.department_id == department_id)
    if op_type is not None:
        try:
            query = query.filter(OperationRecord.op_type == ST(op_type))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid op_type '{op_type}'")
    if date_from is not None:
        query = query.filter(OperationRecord.date >= date_from)
    if date_to is not None:
        query = query.filter(OperationRecord.date <= date_to)
    return query.order_by(OperationRecord.date.desc()).all()


@router.post("/operations", response_model=OperationRecordWithTransaction, status_code=status.HTTP_201_CREATED)
def post_operation(
    op_in: OperationRecordCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "manager")),
):
    """Create an OperationRecord. When Settings.auto_emission_calc is ON,
    automatically resolves an EmissionFactor and creates a linked
    CarbonTransaction. Response includes both the operation and the
    generated transaction (or null) plus an optional warning string."""
    op, txn, warning = create_operation_record(db, op_in)
    return OperationRecordWithTransaction(
        operation=OperationRecordOut.model_validate(op),
        carbon_transaction=CarbonTransactionOut.model_validate(txn) if txn else None,
        warning=warning,
    )


@router.put("/operations/{id}", response_model=OperationRecordOut)
def update_operation(
    id: int,
    op_in: OperationRecordUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "manager")),
):
    op = db.query(OperationRecord).filter(OperationRecord.id == id).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operation record not found")
    for field, value in op_in.model_dump(exclude_unset=True).items():
        setattr(op, field, value)
    db.commit()
    db.refresh(op)
    return op


@router.delete("/operations/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_operation(
    id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "manager")),
):
    op = db.query(OperationRecord).filter(OperationRecord.id == id).first()
    if not op:
        raise HTTPException(status_code=404, detail="Operation record not found")
    db.delete(op)
    db.commit()
