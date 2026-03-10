from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

# ─────────────────────────── Drawings ────────────────────────

class DrawingCreate(BaseModel):
    tool_type: str
    points: List[Dict[str, Any]]

class DrawingOut(DrawingCreate):
    id: int
    user_id: Optional[int]
    symbol: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
