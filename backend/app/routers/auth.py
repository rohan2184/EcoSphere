<<<<<<< HEAD
"""
Auth endpoints (plan §8: Person A) — register, login, me.

Contract matches frontend/src/lib/auth.tsx:
  POST /api/auth/register  {name, email, password}      -> UserOut
  POST /api/auth/login     {email, password}            -> {access_token}
  GET  /api/auth/me        (Bearer)                     -> UserOut
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.auth import User, UserRole
from app.schemas.auth import LoginIn, RegisterIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # ponytail: first registered user becomes admin so the demo is bootstrappable;
    # everyone after is employee. Seed script (Phase 3) creates the real admin.
    role = UserRole.admin if db.query(User).first() is None else UserRole.employee

    user = User(
        name=body.name.strip(),
        email=email,
        password_hash=hash_password(body.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut(
        id=user.id, name=user.name, email=user.email,
        role=user.role.value, department_id=user.department_id,
    )


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")
    return TokenOut(access_token=create_access_token(user.id, user.role.value))


@router.get("/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user)):
    return UserOut(**current_user)
=======
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user
from app.schemas.auth import UserRegister, UserLogin, UserOut, TokenResponse
from app.models.auth import User

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = hash_password(user_in.password)
    new_user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hashed_pw,
        role=user_in.role,
        department_id=user_in.department_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(data={"sub": str(new_user.id), "role": new_user.role.value})
    
    return {"access_token": access_token, "token_type": "bearer", "user": new_user}

@router.post("/login", response_model=TokenResponse)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@router.get("/me", response_model=UserOut)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
>>>>>>> 298a2f4ae1efa6dee0d700286a67fbaa62061142
