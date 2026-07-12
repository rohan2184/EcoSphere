<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 7cd57919805015ea0dc69f6bee14f95a998fbb35
from pydantic import BaseModel, ConfigDict, Field


# ponytail: plain str for email — EmailStr needs the email-validator package;
# the DB unique constraint is the real gate. Upgrade if signup quality matters.
class RegisterIn(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    department_id: int | None = None
<<<<<<< HEAD
=======
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
>>>>>>> 298a2f4ae1efa6dee0d700286a67fbaa62061142
=======
>>>>>>> 7cd57919805015ea0dc69f6bee14f95a998fbb35
