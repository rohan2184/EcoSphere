from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.core import Department, Category, Settings, CategoryType
from app.models.auth import User, UserRole
from app.schemas.core import (
    DepartmentCreate, DepartmentUpdate, DepartmentOut,
    CategoryCreate, CategoryUpdate, CategoryOut,
    SettingsUpdate, SettingsOut, UserAdminUpdate
)
from app.schemas.auth import UserOut

router = APIRouter(tags=["core"])

# Departments
@router.get("/departments", response_model=List[DepartmentOut])
def list_departments(status: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Department)
    if status:
        query = query.filter(Department.status == status)
    return query.all()

@router.post("/departments", response_model=DepartmentOut)
def create_department(dept_in: DepartmentCreate, db: Session = Depends(get_db), admin_user: User = Depends(require_role("admin"))):
    existing = db.query(Department).filter(Department.code == dept_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department code already exists")
    dept = Department(**dept_in.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

@router.get("/departments/{id}", response_model=DepartmentOut)
def get_department(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dept = db.query(Department).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept

@router.put("/departments/{id}", response_model=DepartmentOut)
def update_department(id: int, dept_in: DepartmentUpdate, db: Session = Depends(get_db), admin_user: User = Depends(require_role("admin"))):
    dept = db.query(Department).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    if dept_in.code and dept_in.code != dept.code:
        existing = db.query(Department).filter(Department.code == dept_in.code).first()
        if existing:
            raise HTTPException(status_code=400, detail="Department code already exists")
    for field, value in dept_in.model_dump(exclude_unset=True).items():
        setattr(dept, field, value)
    db.commit()
    db.refresh(dept)
    return dept

@router.delete("/departments/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(id: int, db: Session = Depends(get_db), admin_user: User = Depends(require_role("admin"))):
    dept = db.query(Department).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    db.delete(dept)
    db.commit()

# Categories
@router.get("/categories", response_model=List[CategoryOut])
def list_categories(type: Optional[CategoryType] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Category)
    if type:
        query = query.filter(Category.type == type)
    return query.all()

@router.post("/categories", response_model=CategoryOut)
def create_category(cat_in: CategoryCreate, db: Session = Depends(get_db), admin_user: User = Depends(require_role("admin"))):
    cat = Category(**cat_in.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

@router.get("/categories/{id}", response_model=CategoryOut)
def get_category(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cat = db.query(Category).filter(Category.id == id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return cat

@router.put("/categories/{id}", response_model=CategoryOut)
def update_category(id: int, cat_in: CategoryUpdate, db: Session = Depends(get_db), admin_user: User = Depends(require_role("admin"))):
    cat = db.query(Category).filter(Category.id == id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in cat_in.model_dump(exclude_unset=True).items():
        setattr(cat, field, value)
    db.commit()
    db.refresh(cat)
    return cat

@router.delete("/categories/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(id: int, db: Session = Depends(get_db), admin_user: User = Depends(require_role("admin"))):
    cat = db.query(Category).filter(Category.id == id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()

# Users (Admin only)
@router.get("/users", response_model=List[UserOut])
def list_users(department_id: Optional[int] = None, role: Optional[UserRole] = None, db: Session = Depends(get_db), admin_user: User = Depends(require_role("admin"))):
    query = db.query(User)
    if department_id is not None:
        query = query.filter(User.department_id == department_id)
    if role is not None:
        query = query.filter(User.role == role)
    return query.all()

@router.get("/users/{id}", response_model=UserOut)
def get_user(id: int, db: Session = Depends(get_db), admin_user: User = Depends(require_role("admin"))):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/users/{id}", response_model=UserOut)
def update_user(id: int, user_in: UserAdminUpdate, db: Session = Depends(get_db), admin_user: User = Depends(require_role("admin"))):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in user_in.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user

from app.core.security import get_password_hash
from app.schemas.core import UserCreate

@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(user_in: UserCreate, db: Session = Depends(get_db), admin_user: User = Depends(require_role("admin"))):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    hashed_password = get_password_hash(user_in.password)
    user_data = user_in.model_dump(exclude={"password"})
    user_data["hashed_password"] = hashed_password
    
    user = User(**user_data)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(id: int, db: Session = Depends(get_db), admin_user: User = Depends(require_role("admin"))):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return None

# Settings (Singleton)
@router.get("/settings", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    settings = db.query(Settings).first()
    if not settings:
        settings = Settings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/settings", response_model=SettingsOut)
def update_settings(settings_in: SettingsUpdate, db: Session = Depends(get_db), admin_user: User = Depends(require_role("admin"))):
    settings = db.query(Settings).first()
    if not settings:
        settings = Settings()
        db.add(settings)
    for field, value in settings_in.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings
