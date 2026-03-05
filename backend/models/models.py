from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, UniqueConstraint
from sqlalchemy.sql import func
from core.database.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    indicators = Column(JSON, nullable=True) # Ex: {"RSI": {"period": 14}, "SMA": {"period": 50}}
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class DrawingSession(Base):
    __tablename__ = "drawing_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True) # Может быть Null для анонимов в dev
    symbol = Column(String, index=True, nullable=False)
    timeframe = Column(String, index=True, nullable=False)
    drawings = Column(JSON, nullable=False, default=list) # Array of DrawnObject
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'symbol', 'timeframe', name='uq_drawing_session_user_symbol_tf'),
    )
