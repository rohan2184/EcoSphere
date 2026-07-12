from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.auth import User
from app.models.env import (
    EmissionFactor, ProductESGProfile, CarbonTransaction, EnvironmentalGoal,
)
from app.schemas.env import (
    EmissionFactorCreate, EmissionFactorUpdate, EmissionFactorOut,
    ProductESGProfileCreate, ProductESGProfileUpdate, ProductESGProfileOut,
    CarbonTransactionCreate, CarbonTransactionOut,
    EnvironmentalGoalCreate, EnvironmentalGoalUpdate, EnvironmentalGoalOut,
)
from app.services.emissions import create_carbon_transaction

router = APIRouter(prefix="/env", tags=["env"])


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
