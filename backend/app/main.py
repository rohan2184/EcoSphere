from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import governance, dashboard, reports

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

# Routers (append-only — plan §10)
app.include_router(governance.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
