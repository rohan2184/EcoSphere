from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    auth,
    core,
    dashboard,
    env,
    gamification,
    governance,
    notifications,
    reports,
    social,
)

app = FastAPI(title="EcoSphere API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # allowing all for now or configure for future frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

# Routers (append-only — plan §10). Schema is managed by Alembic
# (`alembic upgrade head`), not create_all.
app.include_router(auth.router, prefix="/api")
app.include_router(core.router, prefix="/api")
app.include_router(env.router, prefix="/api")
app.include_router(governance.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(social.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(gamification.router, prefix="/api")
