"""
Тесты для эндпоинтов /users (register, login, me).
Используется TestClient (sync) поверх AsyncSession c SQLite in-memory.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from core.database.base import Base
from core.database.session import get_db
from main import app

# SQLite in-memory база для тестов
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


@pytest.fixture(scope="module", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="module")
def client():
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ──────────────────────── Tests ────────────────────────

def test_register_user(client: TestClient):
    resp = client.post("/api/v1/users/register", json={"email": "test@example.com", "password": "secret123"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "test@example.com"
    assert data["is_active"] is True
    assert "id" in data


def test_register_duplicate_email(client: TestClient):
    # Повторная регистрация должна вернуть 400
    client.post("/api/v1/users/register", json={"email": "dup@example.com", "password": "abc"})
    resp = client.post("/api/v1/users/register", json={"email": "dup@example.com", "password": "abc"})
    assert resp.status_code == 400


def test_login_user(client: TestClient):
    client.post("/api/v1/users/register", json={"email": "login@example.com", "password": "pass123"})
    resp = client.post("/api/v1/users/login", json={"email": "login@example.com", "password": "pass123"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_wrong_password(client: TestClient):
    resp = client.post("/api/v1/users/login", json={"email": "login@example.com", "password": "wrong"})
    assert resp.status_code == 401


def test_get_me(client: TestClient):
    client.post("/api/v1/users/register", json={"email": "me@example.com", "password": "mypass"})
    login_resp = client.post("/api/v1/users/login", json={"email": "me@example.com", "password": "mypass"})
    token = login_resp.json()["access_token"]

    resp = client.get("/api/v1/users/me", params={"token": token})
    assert resp.status_code == 200
    assert resp.json()["email"] == "me@example.com"
