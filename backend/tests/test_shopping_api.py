import pytest

async def test_create_and_get_list(authed_client):
    resp = await authed_client.post("/api/shopping", json={"name": "Weekly Shop"})
    assert resp.status_code == 201
    list_id = resp.json()["id"]
    assert resp.json()["name"] == "Weekly Shop"
    assert resp.json()["items"] == []

    resp = await authed_client.get(f"/api/shopping/{list_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Weekly Shop"

async def test_add_item_manually(authed_client):
    resp = await authed_client.post("/api/shopping", json={"name": "Weekly Shop"})
    list_id = resp.json()["id"]

    resp = await authed_client.post(f"/api/shopping/{list_id}/items", json={
        "ingredient_name": "milk",
        "quantity": "2",
        "unit": "liters",
    })
    assert resp.status_code == 201
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["ingredient_name"] == "milk"
    assert not items[0]["checked"]

async def test_toggle_item_check(authed_client):
    resp = await authed_client.post("/api/shopping", json={"name": "Weekly Shop"})
    list_id = resp.json()["id"]
    resp = await authed_client.post(f"/api/shopping/{list_id}/items", json={"ingredient_name": "eggs"})
    item_id = resp.json()["items"][0]["id"]

    resp = await authed_client.patch(f"/api/shopping/{list_id}/items/{item_id}/check")
    assert resp.status_code == 200
    assert resp.json()["items"][0]["checked"] is True

    resp = await authed_client.patch(f"/api/shopping/{list_id}/items/{item_id}/check")
    assert resp.json()["items"][0]["checked"] is False

async def test_add_from_recipe(authed_client):
    recipe_resp = await authed_client.post("/api/recipes", json={
        "title": "Pasta",
        "ingredients": [
            {"name": "spaghetti", "quantity": "400", "unit": "g"},
            {"name": "eggs", "quantity": "4"},
        ],
    })
    recipe_id = recipe_resp.json()["id"]
    ingredient_ids = [i["id"] for i in recipe_resp.json()["ingredients"]]

    list_resp = await authed_client.post("/api/shopping", json={"name": "Pasta Night"})
    list_id = list_resp.json()["id"]

    resp = await authed_client.post(f"/api/shopping/{list_id}/add-from-recipe", json={
        "recipe_id": recipe_id,
        "ingredient_ids": ingredient_ids,
    })
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 2
    names = {i["ingredient_name"] for i in items}
    assert "spaghetti" in names

async def test_delete_list(authed_client):
    resp = await authed_client.post("/api/shopping", json={"name": "Temp"})
    list_id = resp.json()["id"]

    resp = await authed_client.delete(f"/api/shopping/{list_id}")
    assert resp.status_code == 204

    resp = await authed_client.get(f"/api/shopping/{list_id}")
    assert resp.status_code == 404
