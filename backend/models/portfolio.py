from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class PortfolioItemCreate(BaseModel):
    symbol: str
    asset_type: str

class PortfolioItemOut(PortfolioItemCreate):
    id: int
    user_id: int
    added_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
