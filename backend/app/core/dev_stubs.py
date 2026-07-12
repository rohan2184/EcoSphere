"""
INTEGRATION SEAM — everything in this file is a placeholder for Person A's real auth + settings. 
Once A's branch merges: delete get_current_user here and import the real one from app.core.security; 
delete get_settings_stub and instead fetch the real Settings row from the DB in each router/service call site. 
Search the codebase for 'from app.core.dev_stubs' and 'from app.core.deps import get_current_user, get_settings_stub' 
to find every call site that needs updating.
"""

from fastapi import Query

def get_current_user(as_role: str = Query("employee", pattern="^(admin|employee)$")):
    """
    Fake user for local dev. Pass ?as_role=admin to test admin views.
    """
    return {
        "id": 1,
        "name": "Alice Eco",
        "email": "alice@example.com",
        "role": as_role,
        "department_id": 1,
    }

class DummySettings:
    badge_auto_award = True
    notify_email = True
    notify_inapp = True

def get_settings_stub():
    """
    Fake settings for local dev.
    """
    return DummySettings()
