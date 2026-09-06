from fastapi import FastAPI
from app.api.v1.endpoints import bandarmology

app = FastAPI(
    title="IDX Bandarmology SaaS API",
    description="Backend API for Bandarmology Analytics Platform",
    version="1.0.0"
)

app.include_router(bandarmology.router, prefix="/api/v1/bandarmology", tags=["Bandarmology"])

@app.get("/")
async def root():
    return {"message": "IDX Bandarmology API is running!"}
