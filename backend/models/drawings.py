from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

# ─────────────────────────── Drawings ────────────────────────

class DrawingSessionBase(BaseModel):
    symbol: str
    timeframe: str
    drawings: list[Dict[str, Any]]

class DrawingSessionCreate(DrawingSessionBase):
    pass

class DrawingSessionOut(DrawingSessionBase):
    id: int
    user_id: Optional[int]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
