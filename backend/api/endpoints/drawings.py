from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from core.database.session import get_db
from models.models import Drawing
from models.drawings import DrawingCreate, DrawingOut

router = APIRouter(prefix="/drawings", tags=["Drawings"])

def get_current_user_id() -> int:
    return 1

@router.get("/{symbol:path}", response_model=List[DrawingOut])
async def get_drawings(
    symbol: str, 
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Получить все сохраненные рисунки для тикера."""
    result = await db.execute(
        select(Drawing).where(
            Drawing.user_id == user_id,
            Drawing.symbol == symbol.upper()
        )
    )
    return list(result.scalars().all())

@router.post("/{symbol:path}", response_model=List[DrawingOut])
async def save_drawings(
    symbol: str, 
    data: List[DrawingCreate],
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Полностью обновить список рисунков для конкретного тикера.
    Старые рисунки удаляются, новые создаются на их месте.
    """
    # Удаляем старые
    old_result = await db.execute(
        select(Drawing).where(
            Drawing.user_id == user_id,
            Drawing.symbol == symbol.upper()
        )
    )
    old_drawings = old_result.scalars().all()
    for d in old_drawings:
        await db.delete(d)
        
    # Добавляем новые
    new_drawings = []
    for item in data:
        new_d = Drawing(
            user_id=user_id,
            symbol=symbol.upper(),
            tool_type=item.tool_type,
            points=item.points
        )
        db.add(new_d)
        new_drawings.append(new_d)
        
    await db.commit()
    for d in new_drawings:
        await db.refresh(d)
        
    return new_drawings

@router.delete("/{symbol:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_drawings(
    symbol: str, 
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Удалить все рисунки (при очистке всех инструментов)."""
    result = await db.execute(
        select(Drawing).where(
            Drawing.user_id == user_id,
            Drawing.symbol == symbol.upper()
        )
    )
    drawings = result.scalars().all()
    
    for d in drawings:
        await db.delete(d)
        
    await db.commit()
