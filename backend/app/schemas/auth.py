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
