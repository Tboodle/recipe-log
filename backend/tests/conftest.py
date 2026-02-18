import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.main import app
from app.core.database import get_db
from app.models import Base

TEST_DB_URL = "postgresql+asyncpg://tyler@localhost:5432/recipedb_test"

@pytest.fixture(autouse=True)
async def setup_db():
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    TestSession = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with TestSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    yield

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    app.dependency_overrides.pop(get_db, None)

@pytest.fixture
async def client(setup_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

@pytest.fixture
async def authed_client(client):
    """Returns an AsyncClient pre-authenticated as a test user."""
    await client.post("/api/auth/register", json={
        "household_name": "Test Household",
        "name": "Test User",
        "email": "test@example.com",
        "password": "testpassword",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "testpassword",
    })
    token = resp.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client
