async def test_create_and_list_tags(authed_client):
    resp = await authed_client.post("/api/tags", json={"name": "Italian", "color": "#f59e0b"})
    assert resp.status_code == 201
    assert resp.json()["name"] == "Italian"

    resp = await authed_client.get("/api/tags")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

async def test_update_tag(authed_client):
    resp = await authed_client.post("/api/tags", json={"name": "Italian"})
    tag_id = resp.json()["id"]

    resp = await authed_client.put(f"/api/tags/{tag_id}", json={"name": "Asian", "color": "#22c55e"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Asian"

async def test_delete_tag(authed_client):
    resp = await authed_client.post("/api/tags", json={"name": "Italian"})
    tag_id = resp.json()["id"]

    resp = await authed_client.delete(f"/api/tags/{tag_id}")
    assert resp.status_code == 204

async def test_assign_tag_to_recipe(authed_client):
    tag_resp = await authed_client.post("/api/tags", json={"name": "Italian"})
    tag_id = tag_resp.json()["id"]

    recipe_resp = await authed_client.post("/api/recipes", json={
        "title": "Pasta",
        "tag_ids": [tag_id],
    })
    assert recipe_resp.status_code == 201
    tags = recipe_resp.json()["tags"]
    assert len(tags) == 1
    assert tags[0]["name"] == "Italian"
