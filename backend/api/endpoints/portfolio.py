from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database.session import get_db
from models.models import PortfolioItem
from models.portfolio import PortfolioItemCreate, PortfolioItemOut

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])

# Временная заглушка
def get_current_user_id() -> int:
    return 1

@router.get("", response_model=list[PortfolioItemOut])
async def get_portfolio(
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Получить весь портфель пользователя."""
    result = await db.execute(
        select(PortfolioItem).where(PortfolioItem.user_id == user_id).order_by(PortfolioItem.added_at.desc())
    )
    return list(result.scalars().all())

@router.post("", response_model=PortfolioItemOut, status_code=status.HTTP_201_CREATED)
async def add_portfolio_item(
    data: PortfolioItemCreate,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Добавить тикер в портфель."""
    # Check if exists
    result = await db.execute(
        select(PortfolioItem).where(
            PortfolioItem.user_id == user_id,
            PortfolioItem.symbol == data.symbol.upper()
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Тикер уже в портфеле")
        
    item = PortfolioItem(
        user_id=user_id,
        symbol=data.symbol.upper(),
        asset_type=data.asset_type
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

@router.delete("/{symbol:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_portfolio_item(
    symbol: str, 
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Удалить тикер из портфеля."""
    result = await db.execute(
        select(PortfolioItem).where(
            PortfolioItem.user_id == user_id,
            PortfolioItem.symbol == symbol.upper()
        )
    )
    item = result.scalar_one_or_none()
    
    if item:
        await db.delete(item)
        await db.commit()
