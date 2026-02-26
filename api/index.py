from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Fish-Net API",
    description="AI 에이전트 기반 역할 배정 및 교육 지원 솔루션",
    version="0.5.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Fish-Net API is running", "version": "0.5.0"}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
