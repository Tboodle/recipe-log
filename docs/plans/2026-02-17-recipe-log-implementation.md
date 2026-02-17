# Recipe Log Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a self-hosted recipe manager with URL/image/manual import, cook mode, and shopping lists.

**Architecture:** React + Vite SPA served by nginx, proxying `/api` to a FastAPI backend, with Postgres for storage. All services run via docker-compose. Auth is JWT + Google OAuth via Authlib/python-jose.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, Authlib, python-jose, recipe-scrapers, pytesseract, React 18, Vite 5, Tailwind CSS 3, shadcn/ui, React Router v6, TanStack Query, Zod

---

## Phase 1: Backend Foundation

### Task 1: Project Structure

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/services/__init__.py`

**Step 1: Create backend directory structure**

```bash
mkdir -p backend/app/{api,core,models,schemas,services/{parser,ocr}}
touch backend/app/__init__.py
touch backend/app/api/__init__.py
touch backend/app/core/__init__.py
touch backend/app/models/__init__.py
touch backend/app/schemas/__init__.py
touch backend/app/services/__init__.py
touch backend/app/services/parser/__init__.py
touch backend/app/services/ocr/__init__.py
```

**Step 2: Write `backend/pyproject.toml`**

```toml
[project]
name = "recipe-log"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "sqlalchemy[asyncio]>=2.0.0",
    "asyncpg>=0.29.0",
    "alembic>=1.13.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "authlib>=1.3.0",
    "httpx>=0.27.0",
    "python-multipart>=0.0.9",
    "pydantic-settings>=2.3.0",
    "recipe-scrapers>=14.0.0",
    "beautifulsoup4>=4.12.0",
    "pytesseract>=0.3.10",
    "Pillow>=10.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=5.0.0",
    "httpx>=0.27.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

**Step 3: Write `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Recipe Log", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

**Step 4: Install dependencies and verify server starts**

```bash
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload
# Expected: Uvicorn running on http://127.0.0.1:8000
curl http://localhost:8000/api/health
# Expected: {"status":"ok"}
```

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend project structure"
```

---

### Task 2: Configuration

**Files:**
- Create: `backend/app/core/config.py`
- Create: `backend/.env.example`

**Step 1: Write `backend/app/core/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/recipedb"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    google_client_id: str = ""
    google_client_secret: str = ""

    parser_backend: str = "local"  # "local" or "ai"
    openai_api_key: str = ""

settings = Settings()
```

**Step 2: Write `backend/.env.example`**

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/recipedb
JWT_SECRET=change-me-in-production
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
PARSER_BACKEND=local
OPENAI_API_KEY=
```

**Step 3: Commit**

```bash
git add backend/app/core/config.py backend/.env.example
git commit -m "feat: add settings configuration"
```

---

### Task 3: Database Setup

**Files:**
- Create: `backend/app/core/database.py`
- Create: `backend/app/models/base.py`

**Step 1: Write `backend/app/core/database.py`**

```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

**Step 2: Write `backend/app/models/base.py`**

```python
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import MetaData

convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=convention)
```

**Step 3: Commit**

```bash
git add backend/app/core/database.py backend/app/models/base.py
git commit -m "feat: add async database engine and session"
```

---

### Task 4: SQLAlchemy Models

**Files:**
- Create: `backend/app/models/household.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/recipe.py`
- Create: `backend/app/models/shopping.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Write `backend/app/models/household.py`**

```python
import uuid
from datetime import datetime, UTC
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Household(Base):
    __tablename__ = "households"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    users: Mapped[list["User"]] = relationship(back_populates="household")
    recipes: Mapped[list["Recipe"]] = relationship(back_populates="household")
    tags: Mapped[list["Tag"]] = relationship(back_populates="household")
    shopping_lists: Mapped[list["ShoppingList"]] = relationship(back_populates="household")
```

**Step 2: Write `backend/app/models/user.py`**

```python
import uuid
from datetime import datetime, UTC
from sqlalchemy import String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
import enum

class UserRole(str, enum.Enum):
    admin = "admin"
    member = "member"

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.member)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    household: Mapped["Household"] = relationship(back_populates="users")
```

**Step 3: Write `backend/app/models/recipe.py`**

```python
import uuid
from datetime import datetime, UTC
from sqlalchemy import String, DateTime, ForeignKey, Integer, Text, JSON, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#84cc16")  # tailwind lime-500

    household: Mapped["Household"] = relationship(back_populates="tags")
    recipes: Mapped[list["Recipe"]] = relationship(secondary="recipe_tags", back_populates="tags")

class RecipeTag(Base):
    __tablename__ = "recipe_tags"

    recipe_id: Mapped[str] = mapped_column(String, ForeignKey("recipes.id"), primary_key=True)
    tag_id: Mapped[str] = mapped_column(String, ForeignKey("tags.id"), primary_key=True)

class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    servings: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prep_time: Mapped[int | None] = mapped_column(Integer, nullable=True)  # minutes
    cook_time: Mapped[int | None] = mapped_column(Integer, nullable=True)  # minutes
    total_time: Mapped[int | None] = mapped_column(Integer, nullable=True)  # minutes
    cuisine: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cooking_method: Mapped[str | None] = mapped_column(String(255), nullable=True)
    suitable_for_diet: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    nutrition: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    household: Mapped["Household"] = relationship(back_populates="recipes")
    ingredients: Mapped[list["Ingredient"]] = relationship(back_populates="recipe", cascade="all, delete-orphan", order_by="Ingredient.order")
    steps: Mapped[list["Step"]] = relationship(back_populates="recipe", cascade="all, delete-orphan", order_by="Step.order")
    tags: Mapped[list["Tag"]] = relationship(secondary="recipe_tags", back_populates="recipes")

class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_id: Mapped[str] = mapped_column(String, ForeignKey("recipes.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)

    recipe: Mapped["Recipe"] = relationship(back_populates="ingredients")

class Step(Base):
    __tablename__ = "steps"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    recipe_id: Mapped[str] = mapped_column(String, ForeignKey("recipes.id"), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0)
    timer_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    recipe: Mapped["Recipe"] = relationship(back_populates="steps")
```

**Step 4: Write `backend/app/models/shopping.py`**

```python
import uuid
from datetime import datetime, UTC
from sqlalchemy import String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class ShoppingList(Base):
    __tablename__ = "shopping_lists"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(String, ForeignKey("households.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    household: Mapped["Household"] = relationship(back_populates="shopping_lists")
    items: Mapped[list["ShoppingItem"]] = relationship(back_populates="list", cascade="all, delete-orphan")

class ShoppingItem(Base):
    __tablename__ = "shopping_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    list_id: Mapped[str] = mapped_column(String, ForeignKey("shopping_lists.id"), nullable=False)
    recipe_id: Mapped[str | None] = mapped_column(String, ForeignKey("recipes.id"), nullable=True)
    ingredient_name: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(100), nullable=True)
    checked: Mapped[bool] = mapped_column(Boolean, default=False)

    list: Mapped["ShoppingList"] = relationship(back_populates="items")
```

**Step 5: Update `backend/app/models/__init__.py`**

```python
from app.models.base import Base
from app.models.household import Household
from app.models.user import User, UserRole
from app.models.recipe import Recipe, Ingredient, Step, Tag, RecipeTag
from app.models.shopping import ShoppingList, ShoppingItem

__all__ = [
    "Base", "Household", "User", "UserRole",
    "Recipe", "Ingredient", "Step", "Tag", "RecipeTag",
    "ShoppingList", "ShoppingItem",
]
```

**Step 6: Commit**

```bash
git add backend/app/models/
git commit -m "feat: add SQLAlchemy ORM models"
```

---

### Task 5: Alembic Migrations

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/` (directory)

**Step 1: Initialize Alembic**

```bash
cd backend
alembic init alembic
```

**Step 2: Replace `backend/alembic/env.py`**

```python
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
from app.core.config import settings
from app.models import Base  # noqa: F401 - imports all models

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online():
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**Step 3: Create and run initial migration**

```bash
cd backend
# Ensure Postgres is running and DATABASE_URL in .env is correct
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Expected output: migration file created in `alembic/versions/`, tables created in Postgres.

**Step 4: Commit**

```bash
git add backend/alembic/ backend/alembic.ini
git commit -m "feat: add Alembic migrations with initial schema"
```

---

## Phase 2: Auth

### Task 6: Security Utilities

**Files:**
- Create: `backend/app/core/security.py`
- Create: `backend/tests/test_security.py`

**Step 1: Write failing test `backend/tests/test_security.py`**

```python
import pytest
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token

def test_password_hash_and_verify():
    hashed = hash_password("mysecretpassword")
    assert hashed != "mysecretpassword"
    assert verify_password("mysecretpassword", hashed)
    assert not verify_password("wrongpassword", hashed)

def test_create_and_decode_token():
    token = create_access_token({"sub": "user-123", "household_id": "hh-456"})
    payload = decode_access_token(token)
    assert payload["sub"] == "user-123"
    assert payload["household_id"] == "hh-456"

def test_decode_invalid_token():
    payload = decode_access_token("not.a.valid.token")
    assert payload is None
```

**Step 2: Run test to confirm it fails**

```bash
cd backend
pytest tests/test_security.py -v
# Expected: FAIL - ImportError or ModuleNotFoundError
```

**Step 3: Write `backend/app/core/security.py`**

```python
from datetime import datetime, timedelta, UTC
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
```

**Step 4: Run tests to confirm they pass**

```bash
cd backend
pytest tests/test_security.py -v
# Expected: 3 passed
```

**Step 5: Commit**

```bash
git add backend/app/core/security.py backend/tests/test_security.py
git commit -m "feat: add JWT and password hashing utilities"
```

---

### Task 7: Auth Dependencies

**Files:**
- Create: `backend/app/core/deps.py`

**Step 1: Write `backend/app/core/deps.py`**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models import User

bearer = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
```

**Step 2: Commit**

```bash
git add backend/app/core/deps.py
git commit -m "feat: add auth dependency for protected routes"
```

---

### Task 8: Auth API Endpoints

**Files:**
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/api/auth.py`
- Create: `backend/tests/test_auth_api.py`
- Modify: `backend/app/main.py`

**Step 1: Write `backend/app/schemas/auth.py`**

```python
from pydantic import BaseModel, EmailStr

class RegisterRequest(BaseModel):
    household_name: str
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class JoinHouseholdRequest(BaseModel):
    household_id: str
    name: str
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    household_id: str
```

**Step 2: Write `backend/app/api/auth.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user
from app.models import User, Household, UserRole
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse
import uuid

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    household = Household(id=str(uuid.uuid4()), name=body.household_name)
    db.add(household)

    user = User(
        id=str(uuid.uuid4()),
        household_id=household.id,
        email=body.email,
        name=body.name,
        hashed_password=hash_password(body.password),
        role=UserRole.admin,
    )
    db.add(user)
    await db.commit()

    token = create_access_token({"sub": user.id, "household_id": household.id})
    return TokenResponse(access_token=token)

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.id, "household_id": user.household_id})
    return TokenResponse(access_token=token)

@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role.value,
        household_id=current_user.household_id,
    )
```

**Step 3: Register router in `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth

app = FastAPI(title="Recipe Log", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

**Step 4: Write `backend/tests/test_auth_api.py`**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.main import app
from app.core.database import get_db
from app.models import Base

TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/recipedb_test"
engine = create_async_engine(TEST_DB_URL)
TestSession = async_sessionmaker(engine, expire_on_commit=False)

async def override_get_db():
    async with TestSession() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

async def test_register_and_login(client):
    resp = await client.post("/api/auth/register", json={
        "household_name": "Smith Family",
        "name": "Alice",
        "email": "alice@example.com",
        "password": "password123",
    })
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    assert token

    resp = await client.post("/api/auth/login", json={
        "email": "alice@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200

async def test_me_requires_auth(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 403

async def test_me_returns_user(client):
    await client.post("/api/auth/register", json={
        "household_name": "Smith Family",
        "name": "Alice",
        "email": "alice@example.com",
        "password": "password123",
    })
    login = await client.post("/api/auth/login", json={
        "email": "alice@example.com",
        "password": "password123",
    })
    token = login.json()["access_token"]
    resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "alice@example.com"
```

**Step 5: Create test database and run tests**

```bash
createdb recipedb_test
cd backend
pytest tests/test_auth_api.py -v
# Expected: 3 passed
```

**Step 6: Commit**

```bash
git add backend/app/api/auth.py backend/app/schemas/auth.py backend/tests/test_auth_api.py backend/app/main.py
git commit -m "feat: add register, login, and /me auth endpoints"
```

---

## Phase 3: Recipe API

### Task 9: Recipe CRUD

**Files:**
- Create: `backend/app/schemas/recipe.py`
- Create: `backend/app/api/recipes.py`
- Create: `backend/tests/test_recipes_api.py`
- Modify: `backend/app/main.py`

**Step 1: Write `backend/app/schemas/recipe.py`**

```python
from pydantic import BaseModel
from datetime import datetime

class IngredientIn(BaseModel):
    name: str
    quantity: str | None = None
    unit: str | None = None
    notes: str | None = None
    order: int = 0

class IngredientOut(IngredientIn):
    id: str

class StepIn(BaseModel):
    title: str | None = None
    description: str
    order: int = 0
    timer_seconds: int | None = None

class StepOut(StepIn):
    id: str

class TagOut(BaseModel):
    id: str
    name: str
    color: str

class RecipeIn(BaseModel):
    title: str
    description: str | None = None
    image_url: str | None = None
    source_url: str | None = None
    author: str | None = None
    servings: str | None = None
    prep_time: int | None = None
    cook_time: int | None = None
    total_time: int | None = None
    cuisine: str | None = None
    category: str | None = None
    cooking_method: str | None = None
    suitable_for_diet: list[str] | None = None
    nutrition: dict | None = None
    tag_ids: list[str] = []
    ingredients: list[IngredientIn] = []
    steps: list[StepIn] = []

class RecipeOut(BaseModel):
    id: str
    household_id: str
    title: str
    description: str | None
    image_url: str | None
    source_url: str | None
    author: str | None
    servings: str | None
    prep_time: int | None
    cook_time: int | None
    total_time: int | None
    cuisine: str | None
    category: str | None
    cooking_method: str | None
    suitable_for_diet: list[str] | None
    nutrition: dict | None
    created_at: datetime
    updated_at: datetime
    tags: list[TagOut] = []
    ingredients: list[IngredientOut] = []
    steps: list[StepOut] = []

class RecipeListItem(BaseModel):
    id: str
    title: str
    description: str | None
    image_url: str | None
    cuisine: str | None
    total_time: int | None
    servings: str | None
    tags: list[TagOut] = []
    created_at: datetime
```

**Step 2: Write `backend/app/api/recipes.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Recipe, Ingredient, Step, Tag
from app.schemas.recipe import RecipeIn, RecipeOut, RecipeListItem
import uuid

router = APIRouter(prefix="/api/recipes", tags=["recipes"])

def _recipe_with_relations():
    return select(Recipe).options(
        selectinload(Recipe.ingredients),
        selectinload(Recipe.steps),
        selectinload(Recipe.tags),
    )

@router.get("", response_model=list[RecipeListItem])
async def list_recipes(
    q: str | None = Query(None),
    tag_id: str | None = Query(None),
    cuisine: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Recipe)
        .options(selectinload(Recipe.tags))
        .where(Recipe.household_id == current_user.household_id)
        .order_by(Recipe.created_at.desc())
    )
    if q:
        stmt = stmt.where(or_(Recipe.title.ilike(f"%{q}%"), Recipe.description.ilike(f"%{q}%")))
    if cuisine:
        stmt = stmt.where(Recipe.cuisine.ilike(f"%{cuisine}%"))
    if tag_id:
        stmt = stmt.join(Recipe.tags).where(Tag.id == tag_id)

    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=RecipeOut, status_code=201)
async def create_recipe(
    body: RecipeIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipe = Recipe(
        id=str(uuid.uuid4()),
        household_id=current_user.household_id,
        **body.model_dump(exclude={"tag_ids", "ingredients", "steps"}),
    )
    db.add(recipe)

    for i, ing in enumerate(body.ingredients):
        db.add(Ingredient(id=str(uuid.uuid4()), recipe_id=recipe.id, **ing.model_dump(), order=i))
    for i, step in enumerate(body.steps):
        db.add(Step(id=str(uuid.uuid4()), recipe_id=recipe.id, **step.model_dump(), order=i))

    if body.tag_ids:
        tags = await db.execute(select(Tag).where(Tag.id.in_(body.tag_ids)))
        recipe.tags = list(tags.scalars().all())

    await db.commit()
    await db.refresh(recipe)

    result = await db.execute(_recipe_with_relations().where(Recipe.id == recipe.id))
    return result.scalar_one()

@router.get("/{recipe_id}", response_model=RecipeOut)
async def get_recipe(
    recipe_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        _recipe_with_relations().where(Recipe.id == recipe_id, Recipe.household_id == current_user.household_id)
    )
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe

@router.put("/{recipe_id}", response_model=RecipeOut)
async def update_recipe(
    recipe_id: str,
    body: RecipeIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        _recipe_with_relations().where(Recipe.id == recipe_id, Recipe.household_id == current_user.household_id)
    )
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    for key, value in body.model_dump(exclude={"tag_ids", "ingredients", "steps"}).items():
        setattr(recipe, key, value)

    # Replace ingredients and steps
    for ing in recipe.ingredients:
        await db.delete(ing)
    for step in recipe.steps:
        await db.delete(step)
    await db.flush()

    for i, ing in enumerate(body.ingredients):
        db.add(Ingredient(id=str(uuid.uuid4()), recipe_id=recipe.id, **ing.model_dump(), order=i))
    for i, step in enumerate(body.steps):
        db.add(Step(id=str(uuid.uuid4()), recipe_id=recipe.id, **step.model_dump(), order=i))

    if body.tag_ids is not None:
        tags = await db.execute(select(Tag).where(Tag.id.in_(body.tag_ids)))
        recipe.tags = list(tags.scalars().all())

    await db.commit()
    result = await db.execute(_recipe_with_relations().where(Recipe.id == recipe_id))
    return result.scalar_one()

@router.delete("/{recipe_id}", status_code=204)
async def delete_recipe(
    recipe_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id, Recipe.household_id == current_user.household_id))
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    await db.delete(recipe)
    await db.commit()
```

**Step 3: Register router in `backend/app/main.py`**

Add `from app.api import auth, recipes` and `app.include_router(recipes.router)`.

**Step 4: Write basic tests `backend/tests/test_recipes_api.py`**

```python
import pytest
from httpx import AsyncClient, ASGITransport
# (same db fixture setup as test_auth_api.py — extract to conftest.py)
from app.main import app

# Use shared conftest for client + auth token fixture
async def test_create_and_get_recipe(authed_client):
    resp = await authed_client.post("/api/recipes", json={
        "title": "Pasta Carbonara",
        "description": "Classic Italian pasta",
        "servings": "4",
        "ingredients": [{"name": "spaghetti", "quantity": "400", "unit": "g"}],
        "steps": [{"description": "Boil water and cook pasta.", "order": 0}],
    })
    assert resp.status_code == 201
    recipe_id = resp.json()["id"]

    resp = await authed_client.get(f"/api/recipes/{recipe_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Pasta Carbonara"
    assert len(resp.json()["ingredients"]) == 1

async def test_list_recipes_with_search(authed_client):
    await authed_client.post("/api/recipes", json={"title": "Pasta Carbonara"})
    await authed_client.post("/api/recipes", json={"title": "Caesar Salad"})

    resp = await authed_client.get("/api/recipes?q=pasta")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

async def test_delete_recipe(authed_client):
    resp = await authed_client.post("/api/recipes", json={"title": "Temp Recipe"})
    recipe_id = resp.json()["id"]
    resp = await authed_client.delete(f"/api/recipes/{recipe_id}")
    assert resp.status_code == 204
```

**Step 5: Create `backend/tests/conftest.py`** with shared fixtures (db setup + authed_client).

**Step 6: Run tests**

```bash
cd backend
pytest tests/test_recipes_api.py -v
# Expected: 3 passed
```

**Step 7: Commit**

```bash
git add backend/app/api/recipes.py backend/app/schemas/recipe.py backend/tests/
git commit -m "feat: add recipe CRUD API with search"
```

---

### Task 10: Tags API

**Files:**
- Create: `backend/app/schemas/tag.py`
- Create: `backend/app/api/tags.py`
- Modify: `backend/app/main.py`

**Step 1: Write `backend/app/schemas/tag.py`**

```python
from pydantic import BaseModel

class TagIn(BaseModel):
    name: str
    color: str = "#84cc16"

class TagOut(BaseModel):
    id: str
    name: str
    color: str
    household_id: str
```

**Step 2: Write `backend/app/api/tags.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Tag
from app.schemas.tag import TagIn, TagOut
import uuid

router = APIRouter(prefix="/api/tags", tags=["tags"])

@router.get("", response_model=list[TagOut])
async def list_tags(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Tag).where(Tag.household_id == current_user.household_id).order_by(Tag.name))
    return result.scalars().all()

@router.post("", response_model=TagOut, status_code=201)
async def create_tag(body: TagIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    tag = Tag(id=str(uuid.uuid4()), household_id=current_user.household_id, **body.model_dump())
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag

@router.put("/{tag_id}", response_model=TagOut)
async def update_tag(tag_id: str, body: TagIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Tag).where(Tag.id == tag_id, Tag.household_id == current_user.household_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    tag.name = body.name
    tag.color = body.color
    await db.commit()
    return tag

@router.delete("/{tag_id}", status_code=204)
async def delete_tag(tag_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Tag).where(Tag.id == tag_id, Tag.household_id == current_user.household_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    await db.delete(tag)
    await db.commit()
```

**Step 3: Register router, run server, verify manually**

```bash
curl -X POST http://localhost:8000/api/tags \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Italian", "color": "#f59e0b"}'
```

**Step 4: Commit**

```bash
git add backend/app/api/tags.py backend/app/schemas/tag.py
git commit -m "feat: add tags CRUD API"
```

---

## Phase 4: Import Pipeline

### Task 11: Parser Abstraction + Local URL Parser

**Files:**
- Create: `backend/app/services/parser/base.py`
- Create: `backend/app/services/parser/local.py`
- Create: `backend/app/services/parser/ai.py`
- Create: `backend/app/services/parser/factory.py`
- Create: `backend/tests/test_parser.py`

**Step 1: Write `backend/app/services/parser/base.py`**

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class ParsedRecipe:
    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    source_url: str | None = None
    author: str | None = None
    servings: str | None = None
    prep_time: int | None = None  # minutes
    cook_time: int | None = None  # minutes
    total_time: int | None = None  # minutes
    cuisine: str | None = None
    category: str | None = None
    ingredients: list[str] = None  # raw strings, parsed by API
    steps: list[str] = None        # raw strings

    def __post_init__(self):
        if self.ingredients is None:
            self.ingredients = []
        if self.steps is None:
            self.steps = []

class RecipeParser(ABC):
    @abstractmethod
    async def parse_url(self, url: str) -> ParsedRecipe:
        """Parse a recipe from a URL."""

    @abstractmethod
    async def parse_text(self, text: str) -> ParsedRecipe:
        """Parse recipe data from raw text."""
```

**Step 2: Write `backend/app/services/parser/local.py`**

```python
import re
import isodate
from recipe_scrapers import scrape_me
from app.services.parser.base import RecipeParser, ParsedRecipe

def _iso_to_minutes(iso: str | None) -> int | None:
    if not iso:
        return None
    try:
        return int(isodate.parse_duration(iso).total_seconds() / 60)
    except Exception:
        return None

class LocalRecipeParser(RecipeParser):
    async def parse_url(self, url: str) -> ParsedRecipe:
        scraper = scrape_me(url)
        return ParsedRecipe(
            title=scraper.title(),
            description=scraper.description() or None,
            image_url=scraper.image() or None,
            source_url=url,
            author=scraper.author() or None,
            servings=str(scraper.yields()) if scraper.yields() else None,
            prep_time=_iso_to_minutes(scraper.prep_time()),
            cook_time=_iso_to_minutes(scraper.cook_time()),
            total_time=_iso_to_minutes(scraper.total_time()),
            cuisine=scraper.cuisine() or None,
            category=scraper.category() or None,
            ingredients=scraper.ingredients(),
            steps=[s.get("text", s) if isinstance(s, dict) else s for s in scraper.instructions_list()],
        )

    async def parse_text(self, text: str) -> ParsedRecipe:
        # Basic heuristic: first non-empty line is title, rest are ingredients/steps
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        return ParsedRecipe(title=lines[0] if lines else "Untitled", ingredients=lines[1:])
```

**Step 3: Write `backend/app/services/parser/ai.py`** (stub for now)

```python
from app.services.parser.base import RecipeParser, ParsedRecipe

class AIRecipeParser(RecipeParser):
    async def parse_url(self, url: str) -> ParsedRecipe:
        raise NotImplementedError("AI parser not yet configured. Set PARSER_BACKEND=local or configure OPENAI_API_KEY.")

    async def parse_text(self, text: str) -> ParsedRecipe:
        raise NotImplementedError("AI parser not yet configured.")
```

**Step 4: Write `backend/app/services/parser/factory.py`**

```python
from app.core.config import settings
from app.services.parser.base import RecipeParser

def get_parser() -> RecipeParser:
    if settings.parser_backend == "ai":
        from app.services.parser.ai import AIRecipeParser
        return AIRecipeParser()
    from app.services.parser.local import LocalRecipeParser
    return LocalRecipeParser()
```

**Step 5: Write `backend/tests/test_parser.py`**

```python
import pytest
from app.services.parser.local import LocalRecipeParser

async def test_parse_text_returns_title():
    parser = LocalRecipeParser()
    result = await parser.parse_text("Simple Pasta\n2 cups flour\n1 egg")
    assert result.title == "Simple Pasta"
    assert "2 cups flour" in result.ingredients
```

**Step 6: Run test**

```bash
cd backend
pip install isodate
pytest tests/test_parser.py -v
# Expected: 1 passed
```

**Step 7: Commit**

```bash
git add backend/app/services/parser/ backend/tests/test_parser.py
git commit -m "feat: add recipe parser abstraction and local URL/text parser"
```

---

### Task 12: OCR Abstraction + Local Tesseract

**Files:**
- Create: `backend/app/services/ocr/base.py`
- Create: `backend/app/services/ocr/local.py`
- Create: `backend/app/services/ocr/ai.py`
- Create: `backend/app/services/ocr/factory.py`

**Step 1: Write `backend/app/services/ocr/base.py`**

```python
from abc import ABC, abstractmethod

class OCRService(ABC):
    @abstractmethod
    async def extract_text(self, image_bytes: bytes) -> str:
        """Extract text from image bytes."""
```

**Step 2: Write `backend/app/services/ocr/local.py`**

```python
import io
import pytesseract
from PIL import Image
from app.services.ocr.base import OCRService

class LocalOCRService(OCRService):
    async def extract_text(self, image_bytes: bytes) -> str:
        image = Image.open(io.BytesIO(image_bytes))
        return pytesseract.image_to_string(image)
```

**Step 3: Write `backend/app/services/ocr/ai.py`** (stub)

```python
from app.services.ocr.base import OCRService

class AIOCRService(OCRService):
    async def extract_text(self, image_bytes: bytes) -> str:
        raise NotImplementedError("AI OCR not yet configured.")
```

**Step 4: Write `backend/app/services/ocr/factory.py`**

```python
from app.core.config import settings
from app.services.ocr.base import OCRService

def get_ocr() -> OCRService:
    if settings.parser_backend == "ai":
        from app.services.ocr.ai import AIOCRService
        return AIOCRService()
    from app.services.ocr.local import LocalOCRService
    return LocalOCRService()
```

**Step 5: Commit**

```bash
git add backend/app/services/ocr/
git commit -m "feat: add OCR abstraction and local Tesseract implementation"
```

---

### Task 13: Import API Endpoints

**Files:**
- Create: `backend/app/api/import_.py`
- Modify: `backend/app/main.py`

**Step 1: Write `backend/app/api/import_.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from app.core.deps import get_current_user
from app.models import User
from app.services.parser.factory import get_parser
from app.services.ocr.factory import get_ocr
from app.schemas.recipe import RecipeIn

router = APIRouter(prefix="/api/import", tags=["import"])

class URLImportRequest(BaseModel):
    url: str

@router.post("/url", response_model=RecipeIn)
async def import_from_url(body: URLImportRequest, current_user: User = Depends(get_current_user)):
    parser = get_parser()
    try:
        parsed = await parser.parse_url(body.url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse recipe from URL: {e}")

    return RecipeIn(
        title=parsed.title or "Untitled Recipe",
        description=parsed.description,
        image_url=parsed.image_url,
        source_url=parsed.source_url,
        author=parsed.author,
        servings=parsed.servings,
        prep_time=parsed.prep_time,
        cook_time=parsed.cook_time,
        total_time=parsed.total_time,
        cuisine=parsed.cuisine,
        category=parsed.category,
        ingredients=[{"name": i, "quantity": None, "unit": None} for i in parsed.ingredients],
        steps=[{"description": s, "order": idx} for idx, s in enumerate(parsed.steps)],
    )

@router.post("/image", response_model=RecipeIn)
async def import_from_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    image_bytes = await file.read()
    ocr = get_ocr()
    parser = get_parser()

    try:
        text = await ocr.extract_text(image_bytes)
        parsed = await parser.parse_text(text)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not extract recipe from image: {e}")

    return RecipeIn(
        title=parsed.title or "Untitled Recipe",
        ingredients=[{"name": i} for i in parsed.ingredients],
        steps=[{"description": s, "order": idx} for idx, s in enumerate(parsed.steps)],
    )
```

**Step 2: Register router in `backend/app/main.py`**

Add `from app.api import import_` and `app.include_router(import_.router)`.

**Step 3: Test manually**

```bash
curl -X POST http://localhost:8000/api/import/url \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.allrecipes.com/recipe/8652/garlic-chicken/"}'
# Expected: JSON with parsed recipe fields
```

**Step 4: Commit**

```bash
git add backend/app/api/import_.py backend/app/main.py
git commit -m "feat: add URL and image import endpoints"
```

---

## Phase 5: Shopping Lists

### Task 14: Shopping List API

**Files:**
- Create: `backend/app/schemas/shopping.py`
- Create: `backend/app/api/shopping.py`
- Modify: `backend/app/main.py`

**Step 1: Write `backend/app/schemas/shopping.py`**

```python
from pydantic import BaseModel
from datetime import datetime

class ShoppingItemIn(BaseModel):
    ingredient_name: str
    quantity: str | None = None
    unit: str | None = None
    recipe_id: str | None = None

class ShoppingItemOut(BaseModel):
    id: str
    ingredient_name: str
    quantity: str | None
    unit: str | None
    recipe_id: str | None
    checked: bool

class ShoppingListIn(BaseModel):
    name: str

class ShoppingListOut(BaseModel):
    id: str
    name: str
    household_id: str
    created_at: datetime
    items: list[ShoppingItemOut] = []

class AddFromRecipeRequest(BaseModel):
    recipe_id: str
    ingredient_ids: list[str]
```

**Step 2: Write `backend/app/api/shopping.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, ShoppingList, ShoppingItem, Ingredient
from app.schemas.shopping import ShoppingListIn, ShoppingListOut, ShoppingItemIn, AddFromRecipeRequest
import uuid

router = APIRouter(prefix="/api/shopping", tags=["shopping"])

@router.get("", response_model=list[ShoppingListOut])
async def list_shopping_lists(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(ShoppingList)
        .options(selectinload(ShoppingList.items))
        .where(ShoppingList.household_id == current_user.household_id)
        .order_by(ShoppingList.created_at.desc())
    )
    return result.scalars().all()

@router.post("", response_model=ShoppingListOut, status_code=201)
async def create_list(body: ShoppingListIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    shopping_list = ShoppingList(id=str(uuid.uuid4()), household_id=current_user.household_id, name=body.name)
    db.add(shopping_list)
    await db.commit()
    await db.refresh(shopping_list)
    return shopping_list

@router.get("/{list_id}", response_model=ShoppingListOut)
async def get_list(list_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(ShoppingList)
        .options(selectinload(ShoppingList.items))
        .where(ShoppingList.id == list_id, ShoppingList.household_id == current_user.household_id)
    )
    sl = result.scalar_one_or_none()
    if not sl:
        raise HTTPException(status_code=404, detail="List not found")
    return sl

@router.post("/{list_id}/items", response_model=ShoppingListOut, status_code=201)
async def add_item(list_id: str, body: ShoppingItemIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ShoppingList).where(ShoppingList.id == list_id, ShoppingList.household_id == current_user.household_id))
    sl = result.scalar_one_or_none()
    if not sl:
        raise HTTPException(status_code=404, detail="List not found")
    item = ShoppingItem(id=str(uuid.uuid4()), list_id=list_id, **body.model_dump())
    db.add(item)
    await db.commit()
    result = await db.execute(select(ShoppingList).options(selectinload(ShoppingList.items)).where(ShoppingList.id == list_id))
    return result.scalar_one()

@router.post("/{list_id}/add-from-recipe", response_model=ShoppingListOut)
async def add_from_recipe(list_id: str, body: AddFromRecipeRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ShoppingList).where(ShoppingList.id == list_id, ShoppingList.household_id == current_user.household_id))
    sl = result.scalar_one_or_none()
    if not sl:
        raise HTTPException(status_code=404, detail="List not found")

    ingredients = await db.execute(select(Ingredient).where(Ingredient.id.in_(body.ingredient_ids), Ingredient.recipe_id == body.recipe_id))
    for ing in ingredients.scalars().all():
        db.add(ShoppingItem(
            id=str(uuid.uuid4()),
            list_id=list_id,
            recipe_id=body.recipe_id,
            ingredient_name=ing.name,
            quantity=ing.quantity,
            unit=ing.unit,
        ))
    await db.commit()
    result = await db.execute(select(ShoppingList).options(selectinload(ShoppingList.items)).where(ShoppingList.id == list_id))
    return result.scalar_one()

@router.patch("/{list_id}/items/{item_id}/check", response_model=ShoppingListOut)
async def toggle_item(list_id: str, item_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ShoppingItem).where(ShoppingItem.id == item_id, ShoppingItem.list_id == list_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.checked = not item.checked
    await db.commit()
    result = await db.execute(select(ShoppingList).options(selectinload(ShoppingList.items)).where(ShoppingList.id == list_id))
    return result.scalar_one()

@router.delete("/{list_id}", status_code=204)
async def delete_list(list_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ShoppingList).where(ShoppingList.id == list_id, ShoppingList.household_id == current_user.household_id))
    sl = result.scalar_one_or_none()
    if not sl:
        raise HTTPException(status_code=404, detail="List not found")
    await db.delete(sl)
    await db.commit()
```

**Step 3: Register router and commit**

```bash
git add backend/app/api/shopping.py backend/app/schemas/shopping.py
git commit -m "feat: add shopping list API with recipe ingredient import"
```

---

## Phase 6: Frontend Foundation

### Task 15: Vite + React Project Setup

**Files:**
- Create: `frontend/` (Vite scaffold)

**Step 1: Scaffold frontend**

```bash
cd /path/to/recipe-log
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**Step 2: Install dependencies**

```bash
npm install react-router-dom @tanstack/react-query axios zod react-hook-form @hookform/resolvers
npm install -D tailwindcss postcss autoprefixer @types/node
npx tailwindcss init -p
```

**Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
# Choose: TypeScript, Default style, zinc base color, CSS variables: yes
```

**Step 4: Add core shadcn components**

```bash
npx shadcn@latest add button card input label badge dialog sheet tabs toast separator skeleton
```

**Step 5: Configure `frontend/tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
      },
      colors: {
        brand: {
          yellow: "#fbbf24",  // amber-400
          green: "#22c55e",   // green-500
          red: "#ef4444",     // red-500
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

**Step 6: Add DM Sans font to `frontend/index.html`**

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

**Step 7: Verify dev server**

```bash
npm run dev
# Expected: Vite server at http://localhost:5173
```

**Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with Vite, React, Tailwind, shadcn"
```

---

### Task 16: API Client + Auth Store

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/store/auth.ts`

**Step 1: Write `frontend/src/lib/api.ts`**

```typescript
import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
```

**Step 2: Write `frontend/src/store/auth.ts`**

```typescript
import { create } from "zustand";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  household_id: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setToken: (token: string) => void;
  fetchMe: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setToken: (token) => {
    sessionStorage.setItem("token", token);
  },
  fetchMe: async () => {
    try {
      const { data } = await api.get("/auth/me");
      set({ user: data, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },
  logout: () => {
    sessionStorage.removeItem("token");
    set({ user: null });
    window.location.href = "/login";
  },
}));
```

**Step 3: Install zustand**

```bash
cd frontend
npm install zustand
```

**Step 4: Commit**

```bash
git add frontend/src/lib/ frontend/src/store/
git commit -m "feat: add API client and auth store"
```

---

### Task 17: Router + Layout

**Files:**
- Create: `frontend/src/main.tsx` (update)
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/Nav.tsx`

**Step 1: Write `frontend/src/App.tsx`**

```tsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import RecipeListPage from "@/pages/RecipeListPage";
import RecipeDetailPage from "@/pages/RecipeDetailPage";
import CookModePage from "@/pages/CookModePage";
import ShoppingListsPage from "@/pages/ShoppingListsPage";
import ShoppingListDetailPage from "@/pages/ShoppingListDetailPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  useEffect(() => { fetchMe(); }, [fetchMe]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="recipes" element={<RecipeListPage />} />
            <Route path="recipes/:id" element={<RecipeDetailPage />} />
            <Route path="shopping" element={<ShoppingListsPage />} />
            <Route path="shopping/:id" element={<ShoppingListDetailPage />} />
          </Route>
          <Route path="/recipes/:id/cook" element={<ProtectedRoute><CookModePage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

**Step 2: Write `frontend/src/components/Nav.tsx`**

```tsx
import { Link, useLocation } from "react-router-dom";
import { BookOpen, ShoppingCart, LayoutDashboard } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Home" },
  { to: "/recipes", icon: BookOpen, label: "Recipes" },
  { to: "/shopping", icon: ShoppingCart, label: "Shopping" },
];

export default function Nav() {
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);

  return (
    <nav className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
      <Link to="/" className="text-2xl font-extrabold tracking-tight text-zinc-900">
        recipe<span className="text-amber-400">log</span>
      </Link>
      <div className="flex items-center gap-2">
        {links.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to}>
            <Button
              variant={location.pathname === to ? "default" : "ghost"}
              size="sm"
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          </Link>
        ))}
        <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
      </div>
    </nav>
  );
}
```

**Step 3: Write `frontend/src/components/Layout.tsx`**

```tsx
import { Outlet } from "react-router-dom";
import Nav from "@/components/Nav";

export default function Layout() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
```

**Step 4: Install lucide-react**

```bash
npm install lucide-react
```

**Step 5: Create stub pages** (each just returns a `<div>PageName</div>` for now):
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/RecipeListPage.tsx`
- `frontend/src/pages/RecipeDetailPage.tsx`
- `frontend/src/pages/CookModePage.tsx`
- `frontend/src/pages/ShoppingListsPage.tsx`
- `frontend/src/pages/ShoppingListDetailPage.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/RegisterPage.tsx`

**Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: add router, layout, and nav shell"
```

---

## Phase 7: Auth UI

### Task 18: Login + Register Pages

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/RegisterPage.tsx`

**Step 1: Write `frontend/src/pages/LoginPage.tsx`**

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const { setToken, fetchMe } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    try {
      const resp = await api.post("/auth/login", data);
      setToken(resp.data.access_token);
      await fetchMe();
      navigate("/");
    } catch {
      setError("root", { message: "Invalid email or password" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-3xl font-extrabold">
            recipe<span className="text-amber-400">log</span>
          </CardTitle>
          <p className="text-zinc-500">Sign in to your household</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register("password")} />
            </div>
            {errors.root && <p className="text-sm text-red-500">{errors.root.message}</p>}
            <Button type="submit" className="w-full bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold" disabled={isSubmitting}>
              Sign in
            </Button>
            <p className="text-center text-sm text-zinc-500">
              New here? <Link to="/register" className="font-medium text-amber-500">Create a household</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Write `frontend/src/pages/RegisterPage.tsx`** (same pattern, adds household_name + name fields, posts to `/auth/register`)

**Step 3: Verify in browser** — navigate to `http://localhost:5173/login`, register, confirm redirect to dashboard.

**Step 4: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx
git commit -m "feat: add login and register pages"
```

---

## Phase 8: Recipe UI

### Task 19: Recipe List Page

**Files:**
- Create: `frontend/src/hooks/useRecipes.ts`
- Modify: `frontend/src/pages/RecipeListPage.tsx`
- Create: `frontend/src/components/RecipeCard.tsx`
- Create: `frontend/src/components/ImportModal.tsx`

**Step 1: Write `frontend/src/hooks/useRecipes.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useRecipes(q?: string, tagId?: string, cuisine?: string) {
  return useQuery({
    queryKey: ["recipes", { q, tagId, cuisine }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (tagId) params.set("tag_id", tagId);
      if (cuisine) params.set("cuisine", cuisine);
      const { data } = await api.get(`/recipes?${params}`);
      return data;
    },
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/recipes", body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/recipes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}
```

**Step 2: Write `frontend/src/components/RecipeCard.tsx`**

```tsx
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  recipe: {
    id: string; title: string; description?: string;
    image_url?: string; total_time?: number; cuisine?: string;
    tags: { id: string; name: string; color: string }[];
  };
}

export default function RecipeCard({ recipe }: Props) {
  return (
    <Link to={`/recipes/${recipe.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
        {recipe.image_url && (
          <div className="h-48 overflow-hidden">
            <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          </div>
        )}
        <CardContent className="p-4 space-y-2">
          <h3 className="font-bold text-lg leading-tight text-zinc-900">{recipe.title}</h3>
          {recipe.description && <p className="text-sm text-zinc-500 line-clamp-2">{recipe.description}</p>}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 flex-wrap">
              {recipe.tags.map(tag => (
                <Badge key={tag.id} style={{ backgroundColor: tag.color + "33", color: tag.color, borderColor: tag.color }}>
                  {tag.name}
                </Badge>
              ))}
            </div>
            {recipe.total_time && (
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <Clock className="h-3 w-3" /> {recipe.total_time}m
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

**Step 3: Write `frontend/src/pages/RecipeListPage.tsx`**

```tsx
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useRecipes } from "@/hooks/useRecipes";
import RecipeCard from "@/components/RecipeCard";
import ImportModal from "@/components/ImportModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function RecipeListPage() {
  const [q, setQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const { data: recipes, isLoading } = useRecipes(q || undefined);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-extrabold text-zinc-900">Recipes</h1>
        <Button onClick={() => setImportOpen(true)} className="bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold gap-2">
          <Plus className="h-4 w-4" /> Add Recipe
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <Input
          placeholder="Search recipes..."
          className="pl-10 text-base"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : recipes?.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-xl font-semibold">No recipes yet</p>
          <p className="mt-1">Add your first recipe to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes?.map((r: any) => <RecipeCard key={r.id} recipe={r} />)}
        </div>
      )}

      <ImportModal open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add frontend/src/hooks/ frontend/src/components/RecipeCard.tsx frontend/src/pages/RecipeListPage.tsx
git commit -m "feat: add recipe list page with search"
```

---

### Task 20: Import Modal (3 Tabs)

**Files:**
- Create: `frontend/src/components/ImportModal.tsx`

**Step 1: Write `frontend/src/components/ImportModal.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useCreateRecipe } from "@/hooks/useRecipes";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

export default function ImportModal({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const createRecipe = useCreateRecipe();
  const [url, setUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const handleURLImport = async () => {
    setUrlLoading(true);
    try {
      const { data } = await api.post("/import/url", { url });
      const recipe = await createRecipe.mutateAsync(data);
      onOpenChange(false);
      navigate(`/recipes/${recipe.id}`);
    } catch (e) {
      alert("Could not parse that URL. Try a different recipe site or use manual entry.");
    } finally {
      setUrlLoading(false);
    }
  };

  const handleImageImport = async (file: File) => {
    setImageLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await api.post("/import/image", form, { headers: { "Content-Type": "multipart/form-data" } });
      const recipe = await createRecipe.mutateAsync(data);
      onOpenChange(false);
      navigate(`/recipes/${recipe.id}`);
    } catch {
      alert("Could not read that image. Try a clearer photo.");
    } finally {
      setImageLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extrabold">Add a Recipe</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="url">
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1">From URL</TabsTrigger>
            <TabsTrigger value="image" className="flex-1">From Photo</TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4 pt-4">
            <div>
              <Label>Recipe URL</Label>
              <Input placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
            </div>
            <Button onClick={handleURLImport} disabled={!url || urlLoading} className="w-full bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold">
              {urlLoading ? "Importing..." : "Import Recipe"}
            </Button>
          </TabsContent>

          <TabsContent value="image" className="space-y-4 pt-4">
            <Label>Upload a photo of a recipe</Label>
            <input
              type="file"
              accept="image/*"
              onChange={e => e.target.files?.[0] && handleImageImport(e.target.files[0])}
              className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-bold file:bg-amber-400 file:text-zinc-900"
            />
            {imageLoading && <p className="text-sm text-zinc-500">Extracting recipe from image...</p>}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 pt-4">
            <p className="text-zinc-500 text-sm">Manual entry opens the full recipe editor.</p>
            <Button
              className="w-full bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold"
              onClick={() => { onOpenChange(false); navigate("/recipes/new"); }}
            >
              Open Recipe Editor
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/ImportModal.tsx
git commit -m "feat: add import modal with URL, image, and manual tabs"
```

---

### Task 21: Recipe Detail Page

**Files:**
- Modify: `frontend/src/pages/RecipeDetailPage.tsx`
- Create: `frontend/src/hooks/useShoppingLists.ts`

**Step 1: Write `frontend/src/pages/RecipeDetailPage.tsx`**

```tsx
import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, ChefHat, Users, Trash2, ShoppingCart, Play } from "lucide-react";
import { api } from "@/lib/api";
import { useDeleteRecipe } from "@/hooks/useRecipes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import AddToListDialog from "@/components/AddToListDialog";

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const deleteRecipe = useDeleteRecipe();
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [addToListOpen, setAddToListOpen] = useState(false);

  const { data: recipe, isLoading } = useQuery({
    queryKey: ["recipe", id],
    queryFn: () => api.get(`/recipes/${id}`).then(r => r.data),
  });

  const toggleIngredient = (ingId: string) => {
    setCheckedIngredients(prev => {
      const next = new Set(prev);
      next.has(ingId) ? next.delete(ingId) : next.add(ingId);
      return next;
    });
  };

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (!recipe) return <p>Recipe not found.</p>;

  const selectedIds = Array.from(checkedIngredients);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {recipe.image_url && (
        <div className="h-72 rounded-2xl overflow-hidden">
          <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-4xl font-extrabold text-zinc-900 leading-tight">{recipe.title}</h1>
          <div className="flex gap-2 shrink-0">
            <Link to={`/recipes/${id}/cook`}>
              <Button className="bg-green-500 text-white hover:bg-green-600 font-bold gap-2">
                <Play className="h-4 w-4" /> Cook
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={async () => { await deleteRecipe.mutateAsync(id!); navigate("/recipes"); }}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {recipe.tags.map((tag: any) => (
            <Badge key={tag.id} style={{ backgroundColor: tag.color + "33", color: tag.color }}>
              {tag.name}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
          {recipe.total_time && <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {recipe.total_time} min</span>}
          {recipe.servings && <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {recipe.servings}</span>}
          {recipe.cuisine && <span className="flex items-center gap-1"><ChefHat className="h-4 w-4" /> {recipe.cuisine}</span>}
        </div>

        {recipe.description && <p className="text-zinc-600">{recipe.description}</p>}
      </div>

      <Separator />

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-zinc-900">Ingredients</h2>
          {selectedIds.length > 0 && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setAddToListOpen(true)}>
              <ShoppingCart className="h-4 w-4" /> Add {selectedIds.length} to list
            </Button>
          )}
        </div>
        <ul className="space-y-2">
          {recipe.ingredients.map((ing: any) => (
            <li key={ing.id} className="flex items-center gap-3">
              <Checkbox
                id={ing.id}
                checked={checkedIngredients.has(ing.id)}
                onCheckedChange={() => toggleIngredient(ing.id)}
              />
              <label htmlFor={ing.id} className="text-zinc-700 cursor-pointer">
                {ing.quantity && <span className="font-semibold">{ing.quantity} {ing.unit} </span>}
                {ing.name}
                {ing.notes && <span className="text-zinc-400"> ({ing.notes})</span>}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <Separator />

      <div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-4">Instructions</h2>
        <ol className="space-y-4">
          {recipe.steps.map((step: any, i: number) => (
            <li key={step.id} className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-400 text-zinc-900 font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div className="pt-1">
                {step.title && <p className="font-semibold text-zinc-800 mb-1">{step.title}</p>}
                <p className="text-zinc-600">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <AddToListDialog
        open={addToListOpen}
        onOpenChange={setAddToListOpen}
        recipeId={id!}
        ingredientIds={selectedIds}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/RecipeDetailPage.tsx
git commit -m "feat: add recipe detail page with ingredient checklist"
```

---

### Task 22: Cook Mode Page

**Files:**
- Modify: `frontend/src/pages/CookModePage.tsx`

**Step 1: Write `frontend/src/pages/CookModePage.tsx`**

```tsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X, Timer } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function CookModePage() {
  const { id } = useParams<{ id: string }>();
  const [stepIndex, setStepIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);

  const { data: recipe } = useQuery({
    queryKey: ["recipe", id],
    queryFn: () => api.get(`/recipes/${id}`).then(r => r.data),
  });

  const steps = recipe?.steps ?? [];
  const currentStep = steps[stepIndex];

  // Reset timer when step changes
  useEffect(() => {
    setTimeLeft(currentStep?.timer_seconds ?? null);
    setTimerRunning(false);
  }, [stepIndex, currentStep?.timer_seconds]);

  // Countdown
  useEffect(() => {
    if (!timerRunning || timeLeft === null || timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft(t => (t ?? 1) - 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timeLeft]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!recipe) return null;

  return (
    <div className="fixed inset-0 bg-zinc-900 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <p className="text-zinc-400 font-medium truncate max-w-xs">{recipe.title}</p>
        <Link to={`/recipes/${id}`}>
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
            <X className="h-6 w-6" />
          </Button>
        </Link>
      </div>

      {/* Step counter */}
      <div className="px-6">
        <p className="text-amber-400 font-bold text-sm uppercase tracking-widest">
          Step {stepIndex + 1} of {steps.length}
        </p>
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-center px-6 py-8">
        <div className="space-y-6 w-full">
          {currentStep?.title && (
            <h2 className="text-2xl font-bold text-zinc-200">{currentStep.title}</h2>
          )}
          <p className="text-3xl font-semibold leading-relaxed text-white">
            {currentStep?.description}
          </p>

          {/* Timer */}
          {timeLeft !== null && (
            <div className="flex items-center gap-4 mt-6">
              <div className="text-5xl font-mono font-bold text-amber-400">
                {formatTime(timeLeft)}
              </div>
              <Button
                variant="outline"
                className="border-zinc-600 text-white gap-2"
                onClick={() => setTimerRunning(r => !r)}
              >
                <Timer className="h-4 w-4" />
                {timerRunning ? "Pause" : "Start Timer"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between p-6 pb-10">
        <Button
          variant="ghost"
          className="text-zinc-400 hover:text-white gap-2 text-lg"
          onClick={() => setStepIndex(i => Math.max(0, i - 1))}
          disabled={stepIndex === 0}
        >
          <ChevronLeft className="h-6 w-6" /> Back
        </Button>

        {/* Progress dots */}
        <div className="flex gap-2">
          {steps.map((_: any, i: number) => (
            <button
              key={i}
              onClick={() => setStepIndex(i)}
              className={`h-2 rounded-full transition-all ${i === stepIndex ? "w-6 bg-amber-400" : "w-2 bg-zinc-600"}`}
            />
          ))}
        </div>

        {stepIndex < steps.length - 1 ? (
          <Button
            className="bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold gap-2 text-lg"
            onClick={() => setStepIndex(i => i + 1)}
          >
            Next <ChevronRight className="h-6 w-6" />
          </Button>
        ) : (
          <Link to={`/recipes/${id}`}>
            <Button className="bg-green-500 text-white hover:bg-green-600 font-bold text-lg">
              Done!
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/CookModePage.tsx
git commit -m "feat: add fullscreen cook mode with step navigation and timer"
```

---

## Phase 9: Shopping UI

### Task 23: Shopping Lists Pages

**Files:**
- Create: `frontend/src/hooks/useShoppingLists.ts`
- Modify: `frontend/src/pages/ShoppingListsPage.tsx`
- Modify: `frontend/src/pages/ShoppingListDetailPage.tsx`
- Create: `frontend/src/components/AddToListDialog.tsx`

**Step 1: Write `frontend/src/hooks/useShoppingLists.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useShoppingLists() {
  return useQuery({
    queryKey: ["shopping-lists"],
    queryFn: () => api.get("/shopping").then(r => r.data),
  });
}

export function useShoppingList(id: string) {
  return useQuery({
    queryKey: ["shopping-list", id],
    queryFn: () => api.get(`/shopping/${id}`).then(r => r.data),
  });
}

export function useCreateShoppingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post("/shopping", { name }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-lists"] }),
  });
}

export function useToggleItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.patch(`/shopping/${listId}/items/${itemId}/check`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list", listId] }),
  });
}

export function useAddFromRecipe(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeId, ingredientIds }: { recipeId: string; ingredientIds: string[] }) =>
      api.post(`/shopping/${listId}/add-from-recipe`, { recipe_id: recipeId, ingredient_ids: ingredientIds }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list", listId] }),
  });
}
```

**Step 2: Write `frontend/src/pages/ShoppingListsPage.tsx`**

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ShoppingCart } from "lucide-react";
import { useShoppingLists, useCreateShoppingList } from "@/hooks/useShoppingLists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ShoppingListsPage() {
  const { data: lists } = useShoppingLists();
  const createList = useCreateShoppingList();
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createList.mutateAsync(newName.trim());
    setNewName("");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-extrabold text-zinc-900">Shopping Lists</h1>

      <div className="flex gap-2">
        <Input placeholder="New list name..." value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleCreate()} />
        <Button onClick={handleCreate} className="bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold gap-2">
          <Plus className="h-4 w-4" /> Create
        </Button>
      </div>

      <div className="space-y-3">
        {lists?.map((list: any) => (
          <Link key={list.id} to={`/shopping/${list.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="h-5 w-5 text-amber-400" />
                  <span className="font-semibold text-zinc-900">{list.name}</span>
                </div>
                <span className="text-sm text-zinc-400">{list.items?.length ?? 0} items</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Write `frontend/src/pages/ShoppingListDetailPage.tsx`**

```tsx
import { useParams } from "react-router-dom";
import { useShoppingList, useToggleItem } from "@/hooks/useShoppingLists";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

export default function ShoppingListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: list, isLoading } = useShoppingList(id!);
  const toggleItem = useToggleItem(id!);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!list) return <p>List not found.</p>;

  const unchecked = list.items.filter((i: any) => !i.checked);
  const checked = list.items.filter((i: any) => i.checked);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-4xl font-extrabold text-zinc-900">{list.name}</h1>

      <ul className="space-y-3">
        {unchecked.map((item: any) => (
          <li key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-zinc-200">
            <Checkbox checked={false} onCheckedChange={() => toggleItem.mutate(item.id)} />
            <span className="text-zinc-800">
              {item.quantity && <strong>{item.quantity} {item.unit} </strong>}
              {item.ingredient_name}
            </span>
          </li>
        ))}
      </ul>

      {checked.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">Checked off</p>
          <ul className="space-y-2">
            {checked.map((item: any) => (
              <li key={item.id} className="flex items-center gap-3 p-3 bg-zinc-100 rounded-xl opacity-60">
                <Checkbox checked onCheckedChange={() => toggleItem.mutate(item.id)} />
                <span className="line-through text-zinc-500">
                  {item.quantity && <strong>{item.quantity} {item.unit} </strong>}
                  {item.ingredient_name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Write `frontend/src/components/AddToListDialog.tsx`**

```tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShoppingLists, useCreateShoppingList, useAddFromRecipe } from "@/hooks/useShoppingLists";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recipeId: string;
  ingredientIds: string[];
}

export default function AddToListDialog({ open, onOpenChange, recipeId, ingredientIds }: Props) {
  const { data: lists } = useShoppingLists();
  const createList = useCreateShoppingList();
  const [newName, setNewName] = useState("");

  const addItems = async (listId: string) => {
    const { mutateAsync } = useAddFromRecipe(listId); // extracted per list
    await mutateAsync({ recipeId, ingredientIds });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Shopping List</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {lists?.map((list: any) => (
            <Button key={list.id} variant="outline" className="w-full justify-start" onClick={() => addItems(list.id)}>
              {list.name}
            </Button>
          ))}
          <div className="flex gap-2 pt-2 border-t">
            <Input placeholder="New list..." value={newName} onChange={e => setNewName(e.target.value)} />
            <Button
              className="bg-amber-400 text-zinc-900 font-bold"
              onClick={async () => {
                if (!newName.trim()) return;
                const list = await createList.mutateAsync(newName.trim());
                await addItems(list.id);
              }}
            >
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 5: Commit**

```bash
git add frontend/src/hooks/useShoppingLists.ts frontend/src/pages/Shopping* frontend/src/components/AddToListDialog.tsx
git commit -m "feat: add shopping list pages and add-to-list dialog"
```

---

## Phase 10: Docker + Deploy

### Task 24: Backend Dockerfile

**Files:**
- Create: `backend/Dockerfile`

**Step 1: Write `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

# System deps for pytesseract
RUN apt-get update && apt-get install -y tesseract-ocr libpq-dev gcc && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 2: Build and verify**

```bash
docker build -t recipe-log-api ./backend
# Expected: successful build
```

**Step 3: Commit**

```bash
git add backend/Dockerfile
git commit -m "feat: add backend Dockerfile with Tesseract"
```

---

### Task 25: Frontend Dockerfile + nginx

**Files:**
- Create: `frontend/Dockerfile`
- Create: `nginx/nginx.conf`

**Step 1: Write `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY ../nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**Step 2: Write `nginx/nginx.conf`**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Step 3: Commit**

```bash
git add frontend/Dockerfile nginx/
git commit -m "feat: add frontend Dockerfile and nginx config"
```

---

### Task 26: docker-compose

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

**Step 1: Write `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-recipe}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-recipe}
      POSTGRES_DB: ${POSTGRES_DB:-recipedb}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U recipe"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-recipe}:${POSTGRES_PASSWORD:-recipe}@db:5432/${POSTGRES_DB:-recipedb}
      JWT_SECRET: ${JWT_SECRET}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
      PARSER_BACKEND: ${PARSER_BACKEND:-local}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
    depends_on:
      db:
        condition: service_healthy
    command: >
      sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"

  nginx:
    build: ./frontend
    ports:
      - "${PORT:-80}:80"
    depends_on:
      - api

volumes:
  postgres_data:
```

**Step 2: Write `.env.example`**

```
POSTGRES_USER=recipe
POSTGRES_PASSWORD=change-me
POSTGRES_DB=recipedb
JWT_SECRET=change-me-to-a-long-random-string
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
PARSER_BACKEND=local
OPENAI_API_KEY=
PORT=80
```

**Step 3: Test full stack**

```bash
cp .env.example .env
# Fill in JWT_SECRET with a random string
docker-compose up --build
# Navigate to http://localhost — should show the app
```

**Step 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat: add docker-compose for full stack deployment"
```

---

### Task 27: GitHub Actions CI

**Files:**
- Create: `.github/workflows/docker.yml`

**Step 1: Write `.github/workflows/docker.yml`**

```yaml
name: Build and Push Docker Image

on:
  push:
    tags:
      - "v*"

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push API
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          platforms: linux/amd64,linux/arm64
          tags: ghcr.io/${{ github.repository }}/api:${{ github.ref_name }}

      - name: Build and push Frontend
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./frontend/Dockerfile
          push: true
          platforms: linux/amd64,linux/arm64
          tags: ghcr.io/${{ github.repository }}/frontend:${{ github.ref_name }}
```

**Step 2: Commit**

```bash
git add .github/
git commit -m "feat: add GitHub Actions CI for multi-arch Docker builds"
```

---

## Completion Checklist

- [ ] Backend health endpoint responds
- [ ] Register + login + /me work end-to-end
- [ ] Recipe CRUD works with ingredients, steps, tags
- [ ] URL import parses at least 3 different recipe sites
- [ ] Image import extracts text from a clear recipe photo
- [ ] Cook mode is fullscreen, swipe-navigable, timer works
- [ ] Shopping list: create, add from recipe, check off items
- [ ] `docker-compose up` starts the full app with no errors
- [ ] App is usable on mobile (responsive layout)
