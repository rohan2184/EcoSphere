from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
