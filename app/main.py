from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.endpoints import bandarmology, dashboard, stocks, idx_test, broker_flow, causality

app = FastAPI(
    title="IDX Bandarmology SaaS API",
    description="Backend API for Bandarmology Analytics Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bandarmology.router, prefix="/api/v1/bandarmology", tags=["Bandarmology"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(broker_flow.router, prefix="/api/v1/broker_flow", tags=["Broker Flow"])
app.include_router(causality.router, prefix="/api/v1/causality", tags=["Causality"])
app.include_router(stocks.router, prefix="/api/v1/stocks", tags=["Stocks"])
app.include_router(idx_test.router, prefix="/api/v1/idx_test", tags=["IDX API Test"])

@app.get("/")
async def root():
    return {"message": "IDX Bandarmology API is running!"}
