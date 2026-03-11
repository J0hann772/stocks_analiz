from fastapi import APIRouter
from api.endpoints import users, strategies, scanner, charts, drawings, portfolio, backtest, formation_scanner

api_router = APIRouter()

api_router.include_router(users.router)
api_router.include_router(strategies.router)
api_router.include_router(scanner.router)
api_router.include_router(charts.router)
api_router.include_router(drawings.router)
api_router.include_router(portfolio.router)
api_router.include_router(backtest.router)
api_router.include_router(formation_scanner.router)
