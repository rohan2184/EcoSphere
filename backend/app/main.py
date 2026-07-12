from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="EcoSphere API")

from app.core.database import engine, Base
from app.models import auth, core, env # import models to ensure they are registered

Base.metadata.create_all(bind=engine)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # allowing all for now or configure for future frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import auth, core, env

app.include_router(auth.router, prefix="/api")
app.include_router(core.router, prefix="/api")
app.include_router(env.router, prefix="/api")

@app.get("/health")
def health_check():
    return {"status": "ok"}
