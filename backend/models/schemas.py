from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from datetime import datetime


# ─────────────────────────── User ───────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    admin_password: str


class UserOut(BaseModel):
    id: int
    email: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ─────────────────────────── Strategy ───────────────────────

class StrategyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    indicators: Optional[Dict[str, Any]] = None
    # Пример: {"RSI": {"period": 14, "overbought": 70, "oversold": 30},
    #           "SMA": {"period": 50}}


class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    indicators: Optional[Dict[str, Any]] = None


class StrategyOut(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str]
    indicators: Optional[Dict[str, Any]]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────── Scanner ────────────────────────

class ScannerParams(BaseModel):
    tickers: Optional[list[str]] = None          # Если None — берём S&P 500
    timeframe: str = "1day"                      # 1min, 5min, 15min, 1hour, 4hour, 1day
    indicators: Dict[str, Any] = {}              # {"RSI": {"period": 14, "max": 40}}
    limit: int = 50                              # макс. кол-во результатов


class ScannerResult(BaseModel):
    ticker: str
    price: Optional[float]
    change_pct: Optional[float]
    indicators: Dict[str, Any]                  # значения индикаторов
    matched: bool

class JobResponse(BaseModel):
    job_id: str
    message: str

class JobProgress(BaseModel):
    status: str # "queued", "running", "completed", "failed"
    total: int = 0
    processed: int = 0
    results: Optional[list[ScannerResult]] = None
    error: Optional[str] = None
