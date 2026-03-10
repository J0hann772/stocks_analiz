from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database.session import get_db
from models.models import Strategy
from models.schemas import StrategyCreate, StrategyUpdate, StrategyOut

router = APIRouter(prefix="/strategies", tags=["Strategies"])


@router.post("", response_model=StrategyOut, status_code=status.HTTP_201_CREATED)
async def create_strategy(
    data: StrategyCreate,
    user_id: int,                          # TODO: заменить на реальный auth dependency
    db: AsyncSession = Depends(get_db),
):
    """Создать новую торговую стратегию."""
    strategy = Strategy(
        user_id=user_id,
        name=data.name,
        description=data.description,
        indicators=data.indicators,
    )
    db.add(strategy)
    await db.commit()
    await db.refresh(strategy)
    return strategy


@router.get("", response_model=list[StrategyOut])
async def list_strategies(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Получить все стратегии пользователя."""
    result = await db.execute(
        select(Strategy).where(Strategy.user_id == user_id)
    )
    return result.scalars().all()


@router.get("/{strategy_id}", response_model=StrategyOut)
async def get_strategy(strategy_id: int, db: AsyncSession = Depends(get_db)):
    """Получить одну стратегию по ID."""
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Стратегия не найдена")
    return strategy


@router.patch("/{strategy_id}", response_model=StrategyOut)
async def update_strategy(
    strategy_id: int,
    data: StrategyUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Обновить стратегию."""
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Стратегия не найдена")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(strategy, field, value)

    await db.commit()
    await db.refresh(strategy)
    return strategy


@router.delete("/{strategy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_strategy(strategy_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить стратегию."""
    result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Стратегия не найдена")
    await db.delete(strategy)
    await db.commit()
