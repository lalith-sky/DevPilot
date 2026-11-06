import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

app = FastAPI(
    title="HackNova API",
    description="Developer platform API with process-local in-memory task and agent records.",
    version="0.2.0",
)

configured_origins = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000,http://127.0.0.1:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in configured_origins.split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(router, prefix="/api/v1")
