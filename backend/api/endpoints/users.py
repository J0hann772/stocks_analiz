import hashlib
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database.session import get_db
from models.models import User
from models.schemas import UserCreate, UserOut, Token
from core.config import settings
from services.telegram import send_telegram_notification

router = APIRouter(prefix="/users", tags=["Users"])


def _hash_password(password: str) -> str:
    """Простое хеширование для этапа тестирования (не для прода)."""
    return hashlib.sha256(password.encode()).hexdigest()


def _simple_token(email: str) -> str:
    """Генерация токена: sha256(email + TEAM_PASSWORD)."""
    raw = f"{email}:{settings.TEAM_PASSWORD}"
    return hashlib.sha256(raw.encode()).hexdigest()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Регистрация нового пользователя."""
    if data.admin_password != "admin":
        raise HTTPException(status_code=403, detail="Неверный пароль администратора")

    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")

    user = User(
        email=data.email,
        hashed_password=_hash_password(data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Отправка уведомления в фоне
    import asyncio
    asyncio.create_task(send_telegram_notification(f"🚀 Новый пользователь зарегистрирован!\nEmail: <b>{user.email}</b>"))
    
    return user


@router.post("/login", response_model=Token)
async def login(data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Простой логин — возвращает токен на основе TEAM_PASSWORD."""
    if data.admin_password != "admin":
        raise HTTPException(status_code=403, detail="Неверный пароль администратора")

    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or user.hashed_password != _hash_password(data.password):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    
    import asyncio
    asyncio.create_task(send_telegram_notification(f"🔑 Пользователь вошел в систему!\nEmail: <b>{user.email}</b>"))

    return {"access_token": _simple_token(data.email)}


@router.get("/me", response_model=UserOut)
async def get_me(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Получить профиль текущего пользователя по токену."""
    # Ищем пользователя чей токен совпадает
    result = await db.execute(select(User))
    users = result.scalars().all()
    for user in users:
        if _simple_token(user.email) == token:
            return user
    raise HTTPException(status_code=401, detail="Неверный токен")

@router.put("/me/timezone", response_model=UserOut)
async def update_timezone(
    timezone: str,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Обновить часовой пояс пользователя."""
    result = await db.execute(select(User))
    users = result.scalars().all()
    for user in users:
        if _simple_token(user.email) == token:
            user.timezone = timezone
            await db.commit()
            await db.refresh(user)
            return user
    raise HTTPException(status_code=401, detail="Неверный токен")
