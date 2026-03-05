from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database.session import get_db
from models.models import DrawingSession
from models.drawings import DrawingSessionCreate, DrawingSessionOut

router = APIRouter(prefix="/drawings", tags=["Drawings"])

# Временная заглушка, пока нет нормальной аутентификации.
# Для dev версии берем ID 1 или None.
def get_current_user_id() -> int:
    return 1

@router.get("/{symbol}/{timeframe}", response_model=DrawingSessionOut)
async def get_drawings(
    symbol: str, 
    timeframe: str, 
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Получить сохраненную сессию рисунков для тикера и таймфрейма."""
    result = await db.execute(
        select(DrawingSession).where(
            DrawingSession.user_id == user_id,
            DrawingSession.symbol == symbol.upper(),
            DrawingSession.timeframe == timeframe
        )
    )
    session = result.scalar_one_or_none()
    
    # Если сессии нет, возвращаем пустой массив drawings
    if not session:
        return DrawingSessionOut(
            id=0,
            user_id=user_id,
            symbol=symbol.upper(),
            timeframe=timeframe,
            drawings=[],
            created_at=None,
            updated_at=None
        )
        
    return session

@router.put("/{symbol}/{timeframe}", response_model=DrawingSessionOut)
async def save_drawings(
    symbol: str, 
    timeframe: str, 
    data: DrawingSessionCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Сохранить или обновить сессию рисунков."""
    result = await db.execute(
        select(DrawingSession).where(
            DrawingSession.user_id == user_id,
            DrawingSession.symbol == symbol.upper(),
            DrawingSession.timeframe == timeframe
        )
    )
    session = result.scalar_one_or_none()
    
    if session:
        # Обновляем существующую
        session.drawings = data.drawings
    else:
        # Создаем новую
        session = DrawingSession(
            user_id=user_id,
            symbol=symbol.upper(),
            timeframe=timeframe,
            drawings=data.drawings
        )
        db.add(session)
        
    await db.commit()
    await db.refresh(session)
    return session

@router.delete("/{symbol}/{timeframe}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_drawings(
    symbol: str, 
    timeframe: str, 
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Удалить сессию рисунков (при очистке всех инструментов)."""
    result = await db.execute(
        select(DrawingSession).where(
            DrawingSession.user_id == user_id,
            DrawingSession.symbol == symbol.upper(),
            DrawingSession.timeframe == timeframe
        )
    )
    session = result.scalar_one_or_none()
    
    if session:
        await db.delete(session)
        await db.commit()
