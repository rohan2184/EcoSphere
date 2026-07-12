from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models.auth import UserRole

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole
    department_id: Optional[int] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: UserRole
    department_id: Optional[int]
    xp_balance: int
    points_balance: int
    is_active: bool

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
