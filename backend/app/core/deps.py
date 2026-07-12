<<<<<<< HEAD
"""
Shared FastAPI dependencies — DB session, real JWT auth, Settings singleton.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
=======
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
>>>>>>> 298a2f4ae1efa6dee0d700286a67fbaa62061142
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.auth import User

<<<<<<< HEAD
from app.core.database import get_db  # single get_db, re-exported (plan §1 fix #3)
from app.core.security import decode_access_token
from app.models.auth import User
from app.models.core import Settings


# ── Auth ─────────────────────────────────────────────────────────────────────

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> dict:
    """
    Decode the Bearer token and load the user.

    Returns a dict ({id, name, email, role, department_id}) because every
    existing router accesses current_user["id"] / .get("role").
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise unauthorized

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()  # noqa: E712
    if user is None:
        raise unauthorized
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "department_id": user.department_id,
    }


def require_role(*roles: str):
    """Dependency factory: 403 unless current user's role is in `roles`."""
    def checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(roles)}",
            )
        return current_user
    return checker


# ── Settings singleton ───────────────────────────────────────────────────────

def get_settings(db: Session) -> Settings:
    """Return the singleton Settings row, creating it with defaults if missing."""
    row = db.query(Settings).first()
    if row is None:
        row = Settings()
        db.add(row)
        db.commit()
        db.refresh(row)
    return row
=======
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
    try:
        user_id = int(user_id_str)
    except ValueError:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    return user

def require_role(*allowed_roles):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker
>>>>>>> 298a2f4ae1efa6dee0d700286a67fbaa62061142
