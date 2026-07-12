"""
Shared FastAPI dependencies — DB session, real JWT auth, Settings singleton.
"""

from fastapi import Depends, HTTPException, status
from app.core.database import get_db
from app.core.dev_stubs import get_current_user, get_settings_stub

# Re-exporting so existing routers don't break
__all__ = ["get_db", "get_current_user", "get_settings_stub", "require_role"]

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
