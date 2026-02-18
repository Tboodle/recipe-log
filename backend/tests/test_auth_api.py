import pytest

async def test_register_creates_user_and_returns_token(client):
    resp = await client.post("/api/auth/register", json={
        "household_name": "Smith Family",
        "name": "Alice",
        "email": "alice@example.com",
        "password": "password123",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

async def test_register_duplicate_email_returns_400(client):
    payload = {
        "household_name": "Smith Family",
        "name": "Alice",
        "email": "alice@example.com",
        "password": "password123",
    }
    await client.post("/api/auth/register", json=payload)
    resp = await client.post("/api/auth/register", json=payload)
    assert resp.status_code == 400

async def test_login_valid_credentials(client):
    await client.post("/api/auth/register", json={
        "household_name": "Smith Family",
        "name": "Alice",
        "email": "alice@example.com",
        "password": "password123",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "alice@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()

async def test_login_wrong_password_returns_401(client):
    await client.post("/api/auth/register", json={
        "household_name": "Smith Family",
        "name": "Alice",
        "email": "alice@example.com",
        "password": "password123",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "alice@example.com",
        "password": "wrongpassword",
    })
    assert resp.status_code == 401

async def test_me_returns_current_user(authed_client):
    resp = await authed_client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test User"
    assert data["role"] == "admin"

async def test_me_requires_auth(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
