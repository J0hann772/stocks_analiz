from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any

from core.database.session import get_db
from core.backtester import SpringBacktester
from services.fmp_client import fmp_client

router = APIRouter(prefix="/backtest", tags=["Backtest"])

def get_current_user_id() -> int:
    return 1

@router.post("/{symbol:path}")
async def run_backtest(
    symbol: str, 
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    asset_type: str = "Stocks",
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Запуск бэктеста по стратегии 4H/5m Spring для конкретного тикера."""
    
    # 1. Загружаем 5m свечи через закэшированный сервис FMP
    data = await fmp_client.get_historical_backtest_data(
        symbol=symbol.upper(),
        from_date=from_date,
        to_date=to_date,
        timeframe="5min"
    )
    
    if not data:
        raise HTTPException(status_code=404, detail="Не удалось загрузить данные для бэктеста.")
        
    # 2. Инициализируем и запускаем бэктестер
    backtester = SpringBacktester(data=data, asset_type=asset_type)
    results = backtester.run()
    
    return results
