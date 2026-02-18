import pytest

async def test_create_recipe_returns_201(authed_client):
    resp = await authed_client.post("/api/recipes", json={
        "title": "Pasta Carbonara",
        "description": "Classic Italian pasta",
        "servings": "4",
        "cuisine": "Italian",
        "ingredients": [
            {"name": "spaghetti", "quantity": "400", "unit": "g"},
            {"name": "eggs", "quantity": "4"},
        ],
        "steps": [
            {"description": "Boil water and cook pasta.", "order": 0},
            {"description": "Mix eggs with cheese.", "order": 1},
        ],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Pasta Carbonara"
    assert len(data["ingredients"]) == 2
    assert len(data["steps"]) == 2
    assert data["cuisine"] == "Italian"

async def test_get_recipe(authed_client):
    resp = await authed_client.post("/api/recipes", json={"title": "Pasta Carbonara"})
    recipe_id = resp.json()["id"]

    resp = await authed_client.get(f"/api/recipes/{recipe_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Pasta Carbonara"

async def test_list_recipes(authed_client):
    await authed_client.post("/api/recipes", json={"title": "Pasta Carbonara"})
    await authed_client.post("/api/recipes", json={"title": "Caesar Salad"})

    resp = await authed_client.get("/api/recipes")
    assert resp.status_code == 200
    assert len(resp.json()) == 2

async def test_list_recipes_search(authed_client):
    await authed_client.post("/api/recipes", json={"title": "Pasta Carbonara"})
    await authed_client.post("/api/recipes", json={"title": "Caesar Salad"})

    resp = await authed_client.get("/api/recipes?q=pasta")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["title"] == "Pasta Carbonara"

async def test_update_recipe(authed_client):
    resp = await authed_client.post("/api/recipes", json={"title": "Old Title"})
    recipe_id = resp.json()["id"]

    resp = await authed_client.put(f"/api/recipes/{recipe_id}", json={"title": "New Title"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "New Title"

async def test_delete_recipe(authed_client):
    resp = await authed_client.post("/api/recipes", json={"title": "Temp Recipe"})
    recipe_id = resp.json()["id"]

    resp = await authed_client.delete(f"/api/recipes/{recipe_id}")
    assert resp.status_code == 204

    resp = await authed_client.get(f"/api/recipes/{recipe_id}")
    assert resp.status_code == 404

async def test_recipe_not_accessible_across_households(authed_client, client):
    resp = await authed_client.post("/api/recipes", json={"title": "Private Recipe"})
    recipe_id = resp.json()["id"]

    # Register a different user in a different household
    await client.post("/api/auth/register", json={
        "household_name": "Other Family",
        "name": "Bob",
        "email": "bob@example.com",
        "password": "password",
    })
    login = await client.post("/api/auth/login", json={"email": "bob@example.com", "password": "password"})
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"

    resp = await client.get(f"/api/recipes/{recipe_id}")
    assert resp.status_code == 404
