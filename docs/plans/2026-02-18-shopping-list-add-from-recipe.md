# Shopping List: Add From Recipe Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add "add all ingredients to shopping list" buttons on the recipe card and recipe detail page, with unit-aware combining when the same ingredient already exists in the list.

**Architecture:** Change `quantity` columns from String to Float (Alembic migration + model/schema updates), add a `backend/app/utils/units.py` utility for fraction parsing, unit normalization, quantity formatting, and combining logic, update the `add_from_recipe` endpoint to optionally add all ingredients and combine on write, update the AI parser to return numeric quantities, and add two new frontend entry points (recipe card cart button + detail page "Add All" button) reusing the existing `AddToListDialog`.

**Tech Stack:** SQLAlchemy + Alembic, Python `fractions.Fraction`, FastAPI, React, TanStack Query, lucide-react

---

### Task 1: Units utility

**Files:**
- Create: `backend/app/utils/__init__.py`
- Create: `backend/app/utils/units.py`
- Create: `backend/tests/test_units.py`

**Step 1: Create the utils package**

```bash
touch backend/app/utils/__init__.py
```

**Step 2: Write the failing tests first**

Create `backend/tests/test_units.py`:

```python
import pytest
from app.utils.units import (
    parse_fraction,
    normalize_unit,
    format_quantity,
    try_combine,
)


# ── parse_fraction ────────────────────────────────────────────────────────────

def test_parse_fraction_integer():
    assert parse_fraction("3") == pytest.approx(3.0)

def test_parse_fraction_simple():
    assert parse_fraction("1/2") == pytest.approx(0.5)

def test_parse_fraction_mixed():
    assert parse_fraction("2 1/4") == pytest.approx(2.25)

def test_parse_fraction_decimal():
    assert parse_fraction(".5") == pytest.approx(0.5)

def test_parse_fraction_non_numeric():
    assert parse_fraction("to taste") is None

def test_parse_fraction_none():
    assert parse_fraction(None) is None


# ── normalize_unit ────────────────────────────────────────────────────────────

def test_normalize_unit_alias():
    assert normalize_unit("tbsp") == "tablespoon"

def test_normalize_unit_plural():
    assert normalize_unit("cups") == "cup"

def test_normalize_unit_tsp():
    assert normalize_unit("tsp") == "teaspoon"

def test_normalize_unit_none():
    assert normalize_unit(None) is None

def test_normalize_unit_oz():
    assert normalize_unit("oz") == "ounce"

def test_normalize_unit_lbs():
    assert normalize_unit("lbs") == "pound"


# ── format_quantity ───────────────────────────────────────────────────────────

def test_format_quantity_half():
    assert format_quantity(0.5) == "1/2"

def test_format_quantity_quarter():
    assert format_quantity(0.25) == "1/4"

def test_format_quantity_third():
    assert format_quantity(1/3) == "1/3"

def test_format_quantity_mixed():
    assert format_quantity(1.5) == "1 1/2"

def test_format_quantity_mixed_quarter():
    assert format_quantity(2.25) == "2 1/4"

def test_format_quantity_whole():
    assert format_quantity(3.0) == "3"

def test_format_quantity_none():
    assert format_quantity(None) == ""


# ── try_combine ───────────────────────────────────────────────────────────────

def test_combine_same_unit():
    qty, unit = try_combine(2.0, "cup", 1.0, "cup")
    assert qty == pytest.approx(3.0)
    assert unit == "cup"

def test_combine_volume_cross_unit():
    # 1 cup + 4 tablespoons = 1.25 cups
    qty, unit = try_combine(1.0, "cup", 4.0, "tablespoon")
    assert qty == pytest.approx(1.25, rel=1e-2)
    assert unit == "cup"

def test_combine_weight_cross_unit():
    # 1 pound + 8 ounces = 1.5 pounds
    qty, unit = try_combine(1.0, "pound", 8.0, "ounce")
    assert qty == pytest.approx(1.5, rel=1e-2)
    assert unit == "pound"

def test_combine_incompatible_categories():
    # volume + weight → not combinable
    assert try_combine(1.0, "cup", 200.0, "gram") is None

def test_combine_missing_qty():
    assert try_combine(None, "cup", 1.0, "cup") is None

def test_combine_non_convertible_same_unit():
    # "clove" + "clove" → sum
    qty, unit = try_combine(2.0, "clove", 3.0, "clove")
    assert qty == pytest.approx(5.0)
    assert unit == "clove"

def test_combine_non_convertible_different_units():
    # "can" vs "clove" → not combinable
    assert try_combine(1.0, "can", 2.0, "clove") is None
```

**Step 3: Run tests — confirm they fail**

```bash
cd backend && source .venv/bin/activate && python -m pytest tests/test_units.py -v
```

Expected: `ModuleNotFoundError` or multiple `FAILED` — the module doesn't exist yet.

**Step 4: Implement `backend/app/utils/units.py`**

```python
from __future__ import annotations
from fractions import Fraction

# ── Fraction parsing ──────────────────────────────────────────────────────────

def parse_fraction(s: str | None) -> float | None:
    """Parse "1/2", "2 1/4", "3", ".5" → float. Returns None for non-numeric."""
    if not s:
        return None
    s = s.strip()
    try:
        parts = s.split()
        if len(parts) == 2:
            return float(Fraction(parts[0])) + float(Fraction(parts[1]))
        return float(Fraction(s))
    except (ValueError, ZeroDivisionError):
        return None

# ── Unit normalization ────────────────────────────────────────────────────────

_ALIASES: dict[str, str] = {
    "tsp": "teaspoon", "t": "teaspoon",
    "tbsp": "tablespoon", "tbl": "tablespoon", "T": "tablespoon",
    "fl oz": "fluid_ounce", "floz": "fluid_ounce",
    "c": "cup",
    "pt": "pint",
    "qt": "quart",
    "gal": "gallon",
    "oz": "ounce",
    "lb": "pound", "lbs": "pound",
    "g": "gram",
    "kg": "kilogram",
    "ml": "milliliter", "mL": "milliliter",
    "l": "liter", "L": "liter",
}

def normalize_unit(unit: str | None) -> str | None:
    if not unit:
        return None
    stripped = unit.strip()
    # Check original string against aliases first (handles "fl oz", "lbs")
    if stripped in _ALIASES:
        return _ALIASES[stripped]
    # Try lowercased + strip trailing 's' for plurals
    lower = stripped.lower().rstrip("s")
    if lower in _ALIASES:
        return _ALIASES[lower]
    return lower

# ── Conversion tables ─────────────────────────────────────────────────────────

_VOLUME_TO_ML: dict[str, float] = {
    "teaspoon": 4.92892,
    "tablespoon": 14.7868,
    "fluid_ounce": 29.5735,
    "cup": 236.588,
    "pint": 473.176,
    "quart": 946.353,
    "gallon": 3785.41,
    "milliliter": 1.0,
    "liter": 1000.0,
}

_WEIGHT_TO_G: dict[str, float] = {
    "gram": 1.0,
    "ounce": 28.3495,
    "pound": 453.592,
    "kilogram": 1000.0,
}

_VOLUME_PREF = ["gallon", "quart", "pint", "cup", "fluid_ounce", "tablespoon", "teaspoon", "milliliter"]
_WEIGHT_PREF = ["kilogram", "pound", "ounce", "gram"]


def _best_volume(ml: float) -> tuple[float, str]:
    for unit in _VOLUME_PREF:
        qty = ml / _VOLUME_TO_ML[unit]
        if qty >= 0.99:
            return qty, unit
    return ml, "milliliter"


def _best_weight(g: float) -> tuple[float, str]:
    for unit in _WEIGHT_PREF:
        qty = g / _WEIGHT_TO_G[unit]
        if qty >= 0.99:
            return qty, unit
    return g, "gram"


def try_combine(
    existing_qty: float | None,
    existing_unit: str | None,
    new_qty: float | None,
    new_unit: str | None,
) -> tuple[float, str] | None:
    """Combine two quantities. Returns (combined, unit) or None if incompatible."""
    if existing_qty is None or new_qty is None:
        return None
    eu = normalize_unit(existing_unit)
    nu = normalize_unit(new_unit)
    if eu in _VOLUME_TO_ML and nu in _VOLUME_TO_ML:
        total_ml = existing_qty * _VOLUME_TO_ML[eu] + new_qty * _VOLUME_TO_ML[nu]
        return _best_volume(total_ml)
    if eu in _WEIGHT_TO_G and nu in _WEIGHT_TO_G:
        total_g = existing_qty * _WEIGHT_TO_G[eu] + new_qty * _WEIGHT_TO_G[nu]
        return _best_weight(total_g)
    if eu is not None and eu == nu:
        return existing_qty + new_qty, eu
    return None

# ── Quantity display ──────────────────────────────────────────────────────────

_FRACTIONS: list[tuple[float, str]] = [
    (1/8,  "1/8"),
    (1/4,  "1/4"),
    (1/3,  "1/3"),
    (3/8,  "3/8"),
    (1/2,  "1/2"),
    (5/8,  "5/8"),
    (2/3,  "2/3"),
    (3/4,  "3/4"),
    (7/8,  "7/8"),
]

def format_quantity(qty: float | None) -> str:
    if qty is None:
        return ""
    whole = int(qty)
    frac = qty - whole
    frac_str = next((s for val, s in _FRACTIONS if abs(frac - val) < 0.02), "")
    if whole == 0:
        return frac_str or f"{qty:.4g}"
    if not frac_str:
        return str(whole) if abs(frac) < 0.02 else f"{qty:.4g}"
    return f"{whole} {frac_str}"
```

**Step 5: Run tests — confirm they pass**

```bash
cd backend && python -m pytest tests/test_units.py -v
```

Expected: all tests pass.

**Step 6: Commit**

```bash
git add backend/app/utils/__init__.py backend/app/utils/units.py backend/tests/test_units.py
git commit -m "feat: add units utility with fraction parsing and combining"
```

---

### Task 2: Alembic migration + model/schema updates

**Files:**
- Create: `backend/alembic/versions/<rev>_float_quantities.py` (generated)
- Modify: `backend/app/models/recipe.py:57`
- Modify: `backend/app/models/shopping.py:25`
- Modify: `backend/app/schemas/recipe.py:5-8,11-12`
- Modify: `backend/app/schemas/shopping.py:5-8,11-15,34`

**Step 1: Update the SQLAlchemy models**

In `backend/app/models/recipe.py`, change line 57:
```python
# Before:
quantity: Mapped[str | None] = mapped_column(String(100), nullable=True)
# After:
quantity: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
```

Also add `import sqlalchemy as sa` at the top if not present (check existing imports — `String`, `Integer` etc. are already imported from `sqlalchemy`; add `Float` to that import):
```python
from sqlalchemy import String, DateTime, ForeignKey, Integer, Text, JSON, ARRAY, Float
```
Then change the column:
```python
quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
```

In `backend/app/models/shopping.py`, change line 25:
```python
# Before:
quantity: Mapped[str | None] = mapped_column(String(100), nullable=True)
# After:
quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
```
Add `Float` to the import at the top of that file:
```python
from sqlalchemy import String, DateTime, ForeignKey, Boolean, Float
```

**Step 2: Update Pydantic schemas**

In `backend/app/schemas/recipe.py`:
```python
class IngredientIn(BaseModel):
    name: str
    quantity: float | None = None   # was str | None
    unit: str | None = None
    notes: str | None = None
    order: int = 0

class IngredientOut(IngredientIn):
    id: str
```

In `backend/app/schemas/shopping.py`:
```python
class ShoppingItemIn(BaseModel):
    ingredient_name: str
    quantity: float | None = None   # was str | None
    unit: str | None = None
    recipe_id: str | None = None

class ShoppingItemOut(BaseModel):
    id: str
    ingredient_name: str
    quantity: float | None           # was str | None
    unit: str | None
    recipe_id: str | None
    checked: bool

    model_config = {"from_attributes": True}

class ShoppingListIn(BaseModel):
    name: str

class ShoppingListOut(BaseModel):
    id: str
    name: str
    household_id: str
    created_at: datetime
    items: list[ShoppingItemOut] = []

    model_config = {"from_attributes": True}

class AddFromRecipeRequest(BaseModel):
    recipe_id: str
    ingredient_ids: list[str] | None = None  # None = add all ingredients
```

**Step 3: Generate Alembic migration**

```bash
cd backend && source .venv/bin/activate && alembic revision --autogenerate -m "float_quantities"
```

This creates a new file in `backend/alembic/versions/`. Open it and verify the `upgrade()` function contains `alter_column` calls for `ingredients.quantity` and `shopping_items.quantity`. If the autogenerated migration looks correct, proceed. If not, edit it to match:

```python
def upgrade() -> None:
    op.alter_column(
        'ingredients', 'quantity',
        existing_type=sa.String(length=100),
        type_=sa.Float(),
        existing_nullable=True,
        postgresql_using="CASE WHEN quantity ~ '^[0-9]+(\\.[0-9]+)?$' THEN quantity::float ELSE NULL END",
    )
    op.alter_column(
        'shopping_items', 'quantity',
        existing_type=sa.String(length=100),
        type_=sa.Float(),
        existing_nullable=True,
        postgresql_using="CASE WHEN quantity ~ '^[0-9]+(\\.[0-9]+)?$' THEN quantity::float ELSE NULL END",
    )

def downgrade() -> None:
    op.alter_column('ingredients', 'quantity', existing_type=sa.Float(), type_=sa.String(length=100), existing_nullable=True)
    op.alter_column('shopping_items', 'quantity', existing_type=sa.Float(), type_=sa.String(length=100), existing_nullable=True)
```

**Step 4: Run the migration**

```bash
cd backend && alembic upgrade head
```

Expected: `Running upgrade ab422bea9156 -> <new_rev>, float_quantities`

**Step 5: Update existing test that passes quantity as string**

In `backend/tests/test_shopping_api.py`, `test_add_item_manually` currently passes `"quantity": "2"`. Update to pass a float:
```python
async def test_add_item_manually(authed_client):
    resp = await authed_client.post("/api/shopping", json={"name": "Weekly Shop"})
    list_id = resp.json()["id"]

    resp = await authed_client.post(f"/api/shopping/{list_id}/items", json={
        "ingredient_name": "milk",
        "quantity": 2.0,       # float, was "2"
        "unit": "liters",
    })
    assert resp.status_code == 201
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["ingredient_name"] == "milk"
    assert not items[0]["checked"]
```

Also update `test_add_from_recipe` to pass float quantities in the recipe:
```python
async def test_add_from_recipe(authed_client):
    recipe_resp = await authed_client.post("/api/recipes", json={
        "title": "Pasta",
        "ingredients": [
            {"name": "spaghetti", "quantity": 400.0, "unit": "g"},
            {"name": "eggs", "quantity": 4.0},
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
```

**Step 6: Run all backend tests**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: all tests pass (the test DB is recreated fresh each run using the updated models, so no migration needed for tests).

**Step 7: Commit**

```bash
git add backend/app/models/recipe.py backend/app/models/shopping.py \
        backend/app/schemas/recipe.py backend/app/schemas/shopping.py \
        backend/alembic/versions/ backend/tests/test_shopping_api.py
git commit -m "feat: change quantity fields from string to float"
```

---

### Task 3: Update `add_from_recipe` endpoint with optional IDs and combining

**Files:**
- Modify: `backend/app/api/shopping.py:56-75`
- Modify: `backend/tests/test_shopping_api.py` (add new tests)

**Step 1: Write new failing tests**

Add to `backend/tests/test_shopping_api.py`:

```python
async def test_add_from_recipe_all_ingredients(authed_client):
    """ingredient_ids=None should add all ingredients."""
    recipe_resp = await authed_client.post("/api/recipes", json={
        "title": "Soup",
        "ingredients": [
            {"name": "water", "quantity": 2.0, "unit": "cup"},
            {"name": "salt", "quantity": 1.0, "unit": "teaspoon"},
        ],
    })
    recipe_id = recipe_resp.json()["id"]
    list_resp = await authed_client.post("/api/shopping", json={"name": "Soup Shop"})
    list_id = list_resp.json()["id"]

    resp = await authed_client.post(f"/api/shopping/{list_id}/add-from-recipe", json={
        "recipe_id": recipe_id,
        # no ingredient_ids — should add all
    })
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 2


async def test_add_from_recipe_combines_same_ingredient(authed_client):
    """Adding butter from two recipes should combine into one list item."""
    recipe1 = await authed_client.post("/api/recipes", json={
        "title": "Recipe 1",
        "ingredients": [{"name": "butter", "quantity": 0.5, "unit": "cup"}],
    })
    recipe2 = await authed_client.post("/api/recipes", json={
        "title": "Recipe 2",
        "ingredients": [{"name": "butter", "quantity": 4.0, "unit": "tablespoon"}],
    })
    list_resp = await authed_client.post("/api/shopping", json={"name": "Combined"})
    list_id = list_resp.json()["id"]

    await authed_client.post(f"/api/shopping/{list_id}/add-from-recipe", json={
        "recipe_id": recipe1.json()["id"],
    })
    resp = await authed_client.post(f"/api/shopping/{list_id}/add-from-recipe", json={
        "recipe_id": recipe2.json()["id"],
    })
    items = resp.json()["items"]
    # Should be 1 combined butter item, not 2
    butter_items = [i for i in items if i["ingredient_name"].lower() == "butter"]
    assert len(butter_items) == 1
    # 0.5 cup + 4 tbsp = 0.5 cup + 0.25 cup = 0.75 cup
    assert butter_items[0]["quantity"] == pytest.approx(0.75, rel=1e-2)
    assert butter_items[0]["unit"] == "cup"
```

**Step 2: Run the new tests — confirm they fail**

```bash
cd backend && python -m pytest tests/test_shopping_api.py::test_add_from_recipe_all_ingredients tests/test_shopping_api.py::test_add_from_recipe_combines_same_ingredient -v
```

Expected: both fail.

**Step 3: Update the endpoint**

Replace `backend/app/api/shopping.py` lines 56-75 with:

```python
@router.post("/{list_id}/add-from-recipe", response_model=ShoppingListOut)
async def add_from_recipe(
    list_id: str,
    body: AddFromRecipeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_list_with_items(db, list_id, current_user.household_id)  # verify ownership

    # Fetch ingredients — all or selected
    if body.ingredient_ids is None:
        result = await db.execute(
            select(Ingredient).where(Ingredient.recipe_id == body.recipe_id)
        )
    else:
        result = await db.execute(
            select(Ingredient).where(
                Ingredient.id.in_(body.ingredient_ids),
                Ingredient.recipe_id == body.recipe_id,
            )
        )
    ingredients = result.scalars().all()

    # Fetch existing items in the list for combining
    existing_result = await db.execute(
        select(ShoppingItem).where(ShoppingItem.list_id == list_id)
    )
    existing_items = existing_result.scalars().all()
    existing_by_name = {item.ingredient_name.lower(): item for item in existing_items}

    for ing in ingredients:
        existing = existing_by_name.get(ing.name.lower())
        if existing:
            combined = try_combine(existing.quantity, existing.unit, ing.quantity, ing.unit)
            if combined:
                existing.quantity, existing.unit = combined
                continue
        new_item = ShoppingItem(
            id=str(uuid.uuid4()),
            list_id=list_id,
            recipe_id=body.recipe_id,
            ingredient_name=ing.name,
            quantity=ing.quantity,
            unit=ing.unit,
        )
        db.add(new_item)
        existing_by_name[ing.name.lower()] = new_item

    await db.commit()
    return await _get_list_with_items(db, list_id, current_user.household_id)
```

Also add the import at the top of `shopping.py`:

```python
from app.utils.units import try_combine
```

**Step 4: Run the new tests — confirm they pass**

```bash
cd backend && python -m pytest tests/test_shopping_api.py -v
```

Expected: all shopping tests pass.

**Step 5: Commit**

```bash
git add backend/app/api/shopping.py backend/tests/test_shopping_api.py
git commit -m "feat: add optional ingredient_ids and combining to add_from_recipe"
```

---

### Task 4: Update parsers — numeric quantities

**Files:**
- Modify: `backend/app/services/parser/ai.py`
- Modify: `backend/app/api/import_.py`

**Step 1: Update the AI parser system prompt**

In `backend/app/services/parser/ai.py`, update `_SYSTEM_PROMPT` so the AI returns `quantity` as a number:

```python
_SYSTEM_PROMPT = """\
You are a recipe extraction assistant. Given raw text from a recipe (OCR'd from a photo or copy-pasted), \
extract the structured recipe data and return ONLY valid JSON matching this schema:

{
  "title": "string",
  "description": "string or null",
  "servings": "string or null",
  "prep_time": number_in_minutes_or_null,
  "cook_time": number_in_minutes_or_null,
  "total_time": number_in_minutes_or_null,
  "ingredients": [{"quantity": number_or_null, "unit": "string or null", "name": "string"}, ...],
  "steps": ["string", ...]
}

Rules:
- title: the recipe name
- ingredients[].quantity: a NUMBER (e.g. 0.5, 2.0, 0.25) — NOT a string. Use null if uncountable ("to taste", "a handful")
- ingredients[].unit: the unit string (e.g. "cup", "tablespoon", "g") or null
- ingredients[].name: the ingredient name without quantity or unit
- steps: each item is one instruction step (no numbering prefix)
- times: integer minutes only, null if not mentioned
- Return ONLY JSON, no markdown fences, no commentary
"""
```

Also update `_parse_json_recipe` to handle the new `ingredients` structure (list of objects, not strings):

```python
def _parse_json_recipe(text: str) -> ParsedRecipe:
    """Parse a JSON string returned by the AI into a ParsedRecipe."""
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip())
    data = json.loads(text)

    ingredients: list[str] = []
    raw_ingredients = data.get("ingredients") or []
    for ing in raw_ingredients:
        if isinstance(ing, str):
            # Legacy plain-string format
            ingredients.append(ing)
        elif isinstance(ing, dict):
            qty = ing.get("quantity")
            unit = ing.get("unit") or ""
            name = ing.get("name") or ""
            parts = [str(qty) if qty is not None else "", unit, name]
            ingredients.append(" ".join(p for p in parts if p).strip())
        else:
            ingredients.append(str(ing))

    return ParsedRecipe(
        title=data.get("title"),
        description=data.get("description"),
        servings=str(data["servings"]) if data.get("servings") else None,
        prep_time=_parse_minutes(data.get("prep_time")),
        cook_time=_parse_minutes(data.get("cook_time")),
        total_time=_parse_minutes(data.get("total_time")),
        ingredients=ingredients,
        steps=data.get("steps") or [],
    )
```

Wait — `ParsedRecipe.ingredients` is currently `list[str]`, and `IngredientIn.name` is set from those strings in `import_.py`. We need to change the pipeline so structured ingredient data flows through properly.

**The cleaner fix:** change `ParsedRecipe.ingredients` to `list[IngredientIn]` so structured data is preserved end-to-end.

Update `backend/app/services/parser/base.py`:

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

@dataclass
class ParsedIngredient:
    name: str
    quantity: float | None = None
    unit: str | None = None
    notes: str | None = None

@dataclass
class ParsedRecipe:
    title: str | None = None
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
    ingredients: list[ParsedIngredient] = field(default_factory=list)
    steps: list[str] = field(default_factory=list)

class RecipeParser(ABC):
    @abstractmethod
    async def parse_url(self, url: str) -> ParsedRecipe: ...

    @abstractmethod
    async def parse_text(self, text: str) -> ParsedRecipe: ...
```

**Step 2: Update `import_.py` to use `ParsedIngredient`**

In `backend/app/api/import_.py`, update `_parsed_to_recipe_in`:

```python
from app.utils.units import parse_fraction

def _parsed_to_recipe_in(parsed) -> RecipeIn:
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
        ingredients=[
            IngredientIn(
                name=i.name,
                quantity=i.quantity,
                unit=i.unit,
                notes=i.notes,
            )
            for i in parsed.ingredients
        ],
        steps=[StepIn(description=s, order=idx) for idx, s in enumerate(parsed.steps)],
    )
```

**Step 3: Update `ai.py` to return `ParsedIngredient` objects**

In `backend/app/services/parser/ai.py`, update `_parse_json_recipe`:

```python
from app.services.parser.base import ParsedRecipe, ParsedIngredient, RecipeParser

def _parse_json_recipe(text: str) -> ParsedRecipe:
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip())
    data = json.loads(text)

    ingredients: list[ParsedIngredient] = []
    for ing in data.get("ingredients") or []:
        if isinstance(ing, dict):
            ingredients.append(ParsedIngredient(
                name=ing.get("name") or "",
                quantity=float(ing["quantity"]) if ing.get("quantity") is not None else None,
                unit=ing.get("unit"),
            ))
        elif isinstance(ing, str):
            ingredients.append(ParsedIngredient(name=ing))

    return ParsedRecipe(
        title=data.get("title"),
        description=data.get("description"),
        servings=str(data["servings"]) if data.get("servings") else None,
        prep_time=_parse_minutes(data.get("prep_time")),
        cook_time=_parse_minutes(data.get("cook_time")),
        total_time=_parse_minutes(data.get("total_time")),
        ingredients=ingredients,
        steps=data.get("steps") or [],
    )
```

**Step 4: Update `local.py` parser to use `ParsedIngredient`**

In `backend/app/services/parser/local.py`, wherever `ParsedRecipe(ingredients=[...])` is built, change the list to `ParsedIngredient` objects. The local parser produces plain-string ingredients like `"2 cups flour"`. Use `parse_fraction` to split them:

```python
from app.services.parser.base import ParsedRecipe, ParsedIngredient, RecipeParser
from app.utils.units import parse_fraction, normalize_unit

def _parse_ingredient_line(line: str) -> ParsedIngredient:
    """Best-effort parse of a raw ingredient string like '2 cups flour'."""
    import re
    # Match optional leading quantity + unit
    m = re.match(
        r'^([\d\s/]+)?\s*'
        r'(teaspoons?|tablespoons?|tbsp?|tsp?|cups?|pints?|quarts?|gallons?|'
        r'ounces?|oz|pounds?|lbs?|grams?|g|kilograms?|kg|ml|liters?|l|cloves?|'
        r'cans?|slices?|pieces?|sprigs?|bunches?)?\s*(.+)',
        line.strip(), re.IGNORECASE
    )
    if m:
        qty_str, unit_str, name = m.group(1), m.group(2), m.group(3)
        return ParsedIngredient(
            name=name.strip(),
            quantity=parse_fraction(qty_str.strip()) if qty_str else None,
            unit=unit_str.strip().lower() if unit_str else None,
        )
    return ParsedIngredient(name=line.strip())
```

Then in `parse_text` wherever you build the ingredients list, wrap each string with `_parse_ingredient_line(line)`.

Similarly for `parse_url`, wrap recipe-scrapers ingredient strings with `_parse_ingredient_line`.

**Step 5: Update `local.py` parse_url to use `ParsedIngredient`**

In `backend/app/services/parser/local.py`, `parse_url` currently calls recipe-scrapers which returns `list[str]` from `scraper.ingredients()`. Wrap each with `_parse_ingredient_line`:

```python
ingredients=[_parse_ingredient_line(i) for i in scraper.ingredients()],
```

Do the same in `ai.py`'s `parse_url` for the recipe-scrapers path:
```python
ingredients=[_parse_ingredient_line(i) for i in ingredients],
```
(import `_parse_ingredient_line` from local or move it to utils)

Actually, to avoid duplication, move `_parse_ingredient_line` to `backend/app/utils/units.py` as `parse_ingredient_string(line: str) -> ParsedIngredient`. Both parsers import from there.

**Step 6: Run all backend tests**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: all pass.

**Step 7: Commit**

```bash
git add backend/app/services/parser/ backend/app/api/import_.py backend/app/utils/units.py
git commit -m "feat: use ParsedIngredient with float quantity through parser pipeline"
```

---

### Task 5: Frontend quantity utility

**Files:**
- Create: `frontend/src/lib/quantity.ts`
- Modify: `frontend/src/hooks/useRecipes.ts:26`

**Step 1: Update the `Ingredient` TypeScript type**

In `frontend/src/hooks/useRecipes.ts`, change `quantity` from `string | null` to `number | null`:

```ts
export interface Ingredient {
  id: string;
  name: string;
  quantity: number | null;   // was string | null
  unit: string | null;
  notes: string | null;
  order: number;
}
```

Also update `ShoppingItemOut` type in `frontend/src/hooks/useShoppingLists.ts` (check if it exists; if not, check where shopping types are defined):

**Step 2: Find and update shopping list types**

```bash
grep -r "ingredient_name\|ShoppingItem" frontend/src --include="*.ts" -l
```

Update any `quantity: string | null` in shopping types to `quantity: number | null`.

**Step 3: Create `frontend/src/lib/quantity.ts`**

```ts
const FRACTIONS: Array<[number, string]> = [
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [3 / 8, "3/8"],
  [1 / 2, "1/2"],
  [5 / 8, "5/8"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
  [7 / 8, "7/8"],
];

export function formatQuantity(qty: number | null | undefined): string {
  if (qty == null) return "";
  const whole = Math.floor(qty);
  const frac = qty - whole;
  const fracStr = FRACTIONS.find(([val]) => Math.abs(frac - val) < 0.02)?.[1] ?? "";
  if (whole === 0) return fracStr || String(qty);
  if (!fracStr) return Math.abs(frac) < 0.02 ? String(whole) : String(qty);
  return `${whole} ${fracStr}`;
}
```

**Step 4: Run the frontend type-checker**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -40
```

Fix any type errors (likely in `RecipeDetailPage` and `ShoppingListDetailPage` where `ing.quantity` was used as a string).

**Step 5: Commit**

```bash
git add frontend/src/lib/quantity.ts frontend/src/hooks/useRecipes.ts
git commit -m "feat: add formatQuantity utility and update Ingredient.quantity to number"
```

---

### Task 6: Update `AddToListDialog` — optional ingredientIds

**Files:**
- Modify: `frontend/src/components/AddToListDialog.tsx`

**Step 1: Update the component**

Replace the full file content:

```tsx
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

interface ShoppingList {
  id: string;
  name: string;
  items: unknown[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recipeId: string;
  ingredientIds?: string[];  // undefined = add all
}

export default function AddToListDialog({ open, onOpenChange, recipeId, ingredientIds }: Props) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");

  const { data: lists } = useQuery<ShoppingList[]>({
    queryKey: ["shopping-lists"],
    queryFn: () => api.get("/shopping").then((r) => r.data),
    enabled: open,
  });

  const buildBody = () =>
    ingredientIds !== undefined
      ? { recipe_id: recipeId, ingredient_ids: ingredientIds }
      : { recipe_id: recipeId };

  const addToList = useMutation({
    mutationFn: (listId: string) =>
      api.post(`/shopping/${listId}/add-from-recipe`, buildBody()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      onOpenChange(false);
    },
  });

  const createAndAdd = useMutation({
    mutationFn: async (name: string) => {
      const { data: list } = await api.post("/shopping", { name });
      await api.post(`/shopping/${list.id}/add-from-recipe`, buildBody());
      return list;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      setNewName("");
      onOpenChange(false);
    },
  });

  const title =
    ingredientIds !== undefined
      ? `Add ${ingredientIds.length} ingredient${ingredientIds.length !== 1 ? "s" : ""} to list`
      : "Add all ingredients to list";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {lists?.map((list) => (
            <Button
              key={list.id}
              variant="outline"
              className="w-full justify-start font-medium"
              onClick={() => addToList.mutate(list.id)}
              disabled={addToList.isPending}
            >
              {list.name}
              <span className="ml-auto text-xs text-zinc-400">{(list.items as unknown[]).length} items</span>
            </Button>
          ))}
          {lists?.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-2">No lists yet — create one below</p>
          )}
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Input
            placeholder="New list name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newName.trim() && createAndAdd.mutate(newName.trim())}
          />
          <Button
            disabled={!newName.trim() || createAndAdd.isPending}
            className="bg-amber-400 text-zinc-900 hover:bg-amber-500 font-bold shrink-0"
            onClick={() => createAndAdd.mutate(newName.trim())}
          >
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

**Step 3: Commit**

```bash
git add frontend/src/components/AddToListDialog.tsx
git commit -m "feat: make ingredientIds optional in AddToListDialog (supports add-all)"
```

---

### Task 7: Update `RecipeCard` — add cart button

**Files:**
- Modify: `frontend/src/components/RecipeCard.tsx`

**Step 1: Update the component**

The card currently wraps everything in a `<Link>`. Change the outer element to a `<div className="relative">` and add a cart button that stops propagation. The inner `<Link>` covers the entire card.

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Users, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AddToListDialog from "@/components/AddToListDialog";
import type { RecipeListItem } from "@/hooks/useRecipes";

export default function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div className="relative group">
        <Link to={`/recipes/${recipe.id}`} className="block h-full">
          <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
            {recipe.image_url ? (
              <div className="h-44 overflow-hidden bg-zinc-100">
                <img
                  src={recipe.image_url}
                  alt={recipe.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ) : (
              <div className="h-44 bg-gradient-to-br from-amber-50 to-zinc-100 flex items-center justify-center">
                <span className="text-4xl">🍽️</span>
              </div>
            )}
            <CardContent className="p-4 space-y-2">
              <h3 className="font-bold text-lg leading-snug text-zinc-900 line-clamp-2">
                {recipe.title}
              </h3>
              {recipe.description && (
                <p className="text-sm text-zinc-500 line-clamp-2">{recipe.description}</p>
              )}
              <div className="flex items-center justify-between pt-1">
                <div className="flex gap-1 flex-wrap">
                  {recipe.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag.id}
                      style={{
                        backgroundColor: tag.color + "22",
                        color: tag.color,
                        borderColor: tag.color + "44",
                      }}
                      className="text-xs font-medium border"
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400 shrink-0">
                  {recipe.total_time && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {recipe.total_time}m
                    </span>
                  )}
                  {recipe.servings && (
                    <span className="flex items-center gap-0.5">
                      <Users className="h-3 w-3" />
                      {recipe.servings}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Cart button — overlaid, stops navigation */}
        <Button
          size="icon"
          variant="secondary"
          className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-amber-50 border border-zinc-200 shadow-sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setAddOpen(true);
          }}
          title="Add to shopping list"
        >
          <ShoppingCart className="h-4 w-4 text-zinc-600" />
        </Button>
      </div>

      <AddToListDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        recipeId={recipe.id}
        // no ingredientIds → adds all
      />
    </>
  );
}
```

**Step 2: Type-check and verify**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add frontend/src/components/RecipeCard.tsx
git commit -m "feat: add cart button to recipe card for add-all-to-shopping-list"
```

---

### Task 8: Update `RecipeDetailPage` — "Add All" button + formatQuantity

**Files:**
- Modify: `frontend/src/pages/RecipeDetailPage.tsx`

**Step 1: Add the "Add All" button and use `formatQuantity`**

Changes needed in `RecipeDetailPage.tsx`:

1. Add `formatQuantity` import: `import { formatQuantity } from "@/lib/quantity";`
2. Add a second `addToListOpen` state for the "add all" flow, or reuse the existing one with `selectedIds` being empty — cleanest is to add a separate state variable `addAllOpen`.
3. Add the persistent "Add All to List" button in the header row (alongside Cook button).
4. Replace `{ing.quantity}` with `{formatQuantity(ing.quantity)}` in the ingredient list.
5. Add a second `<AddToListDialog>` instance for "add all" (no `ingredientIds`).

Key changes (show only the modified sections):

```tsx
// Imports — add:
import { formatQuantity } from "@/lib/quantity";

// State — add:
const [addAllOpen, setAddAllOpen] = useState(false);

// Header buttons — add the cart button before the delete button:
<Button
  variant="outline"
  size="sm"
  className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
  onClick={() => setAddAllOpen(true)}
>
  <ShoppingCart className="h-4 w-4" />
  Add to List
</Button>

// Ingredient display — replace:
// Before: {ing.quantity && <span className="font-semibold">{ing.quantity}{ing.unit ? ` ${ing.unit}` : ""} </span>}
// After:
{(ing.quantity != null || ing.unit) && (
  <span className="font-semibold text-zinc-900">
    {formatQuantity(ing.quantity)}
    {ing.unit ? ` ${ing.unit}` : ""}{" "}
  </span>
)}

// After the existing <AddToListDialog> — add:
<AddToListDialog
  open={addAllOpen}
  onOpenChange={setAddAllOpen}
  recipeId={id!}
  // no ingredientIds → adds all
/>
```

**Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add frontend/src/pages/RecipeDetailPage.tsx
git commit -m "feat: add persistent Add All to List button on recipe detail page"
```

---

### Task 9: Update `ShoppingListDetailPage` — formatQuantity

**Files:**
- Modify: `frontend/src/pages/ShoppingListDetailPage.tsx`
- Modify: `frontend/src/hooks/useShoppingLists.ts` (if it exists; update `quantity` type)

**Step 1: Find and update shopping hook types**

```bash
cat frontend/src/hooks/useShoppingLists.ts
```

Update any `quantity: string | null` in the `ShoppingItem` interface to `quantity: number | null`.

**Step 2: Update `ShoppingListDetailPage.tsx`**

Add `formatQuantity` import and replace all quantity display occurrences:

```tsx
import { formatQuantity } from "@/lib/quantity";

// Replace both display blocks (unchecked + checked items):
// Before: {item.quantity && <strong>{item.quantity}{item.unit ? ` ${item.unit}` : ""} </strong>}
// After:
{(item.quantity != null || item.unit) && (
  <strong>
    {formatQuantity(item.quantity)}
    {item.unit ? ` ${item.unit}` : ""}{" "}
  </strong>
)}
```

**Step 3: Type-check and run all backend tests**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
cd backend && python -m pytest tests/ -v
```

Expected: no type errors, all backend tests pass.

**Step 4: Commit**

```bash
git add frontend/src/pages/ShoppingListDetailPage.tsx frontend/src/hooks/
git commit -m "feat: display shopping list quantities as fractions"
```

---

### Final: Run full test suite

```bash
# Backend
cd backend && python -m pytest tests/ -v

# Frontend types
cd frontend && npx tsc --noEmit

# E2E
cd e2e && npx playwright test tests/app.spec.ts --reporter=line
```

All should pass before declaring done.
