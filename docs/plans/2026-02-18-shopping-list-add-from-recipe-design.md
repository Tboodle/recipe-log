# Shopping List: Add From Recipe Design

**Goal:** Add "add all ingredients to shopping list" buttons on both the recipe card and recipe detail page, with smart unit-aware combining when the same ingredient already exists in the list.

**Architecture:** Float quantity storage + a unit conversion utility + pre-combine-on-write logic in the `add_from_recipe` endpoint. Two new UI entry points both reuse the existing `AddToListDialog`.

**Tech Stack:** SQLAlchemy + Alembic (migration), Python (units utility), FastAPI (endpoint update), React + TanStack Query (frontend buttons + dialog)

---

## Data Model

`ingredients.quantity` and `shopping_items.quantity` both change from `String(100)` to `Float` (nullable).

Alembic migration parses existing string values (`"1/2"` → `0.5`, `"2 1/4"` → `2.25`). Values that can't be parsed (`"to taste"`, `"a handful"`) become `NULL`.

---

## Unit Conversion (`backend/app/utils/units.py`)

**Alias normalization** (string → canonical name):
- `tsp`, `t` → `teaspoon`
- `tbsp`, `T`, `tbl` → `tablespoon`
- `fl oz` → `fluid_ounce`
- `c` → `cup`
- `oz` → `ounce` (weight)
- `lb`, `lbs` → `pound`
- `g` → `gram`, `kg` → `kilogram`

**Categories and base units:**
- `VOLUME`: teaspoon → tablespoon → fluid_ounce → cup → pint → quart → gallon (base: ml)
- `WEIGHT`: gram → ounce → pound → kilogram (base: g)
- Anything else (pinch, clove, can, etc.) is not combinable.

**Combining rule:** given an existing item and a new item with the same normalized ingredient name:
1. Normalize both unit strings.
2. If same category: convert both to base unit, sum, convert back to the largest unit where quantity ≥ 1.
3. Otherwise: insert new row.

**`format_quantity(qty: float | None) -> str`:**
- `0.25` → `"1/4"`, `0.333` → `"1/3"`, `0.5` → `"1/2"`, `0.667` → `"2/3"`, `0.75` → `"3/4"`
- Mixed numbers: `1.5` → `"1 1/2"`, `2.25` → `"2 1/4"`
- Whole numbers: `3.0` → `"3"`
- `None` → `""`

**`parse_fraction(s: str | None) -> float | None`:**
- Handles `"1/2"`, `"2 1/4"`, `"3"`, `".5"`. Returns `None` for non-numeric strings.

**`normalize_unit(s: str | None) -> str | None`:**
- Lowercases, strips whitespace, strips trailing `s` for plurals, applies alias map.

**Ingredient name matching:** case-insensitive exact match on `ingredient_name`. No fuzzy matching.

---

## Backend API Changes

### `AddFromRecipeRequest` schema (`app/schemas/shopping.py`)

```python
class AddFromRecipeRequest(BaseModel):
    recipe_id: str
    ingredient_ids: list[str] | None = None  # None = add all ingredients
```

### `add_from_recipe` endpoint (`app/api/shopping.py`)

1. If `ingredient_ids` is `None`, fetch all ingredients for `recipe_id`. Otherwise fetch by IDs as before.
2. For each ingredient, check if an existing `ShoppingItem` in the list has the same normalized `ingredient_name` (case-insensitive).
3. If found and units are compatible: combine quantities, update the existing row.
4. If not found or incompatible units: insert a new row.

### Parser changes

**AI parser** (`app/services/parser/ai.py`): update system prompt to request `quantity` as a number (`0.5` not `"1/2"`).

**Import route** (`app/api/import_.py`): after recipe-scrapers returns string quantities, call `parse_fraction()` before building `IngredientIn`.

---

## Frontend Changes

### `frontend/src/lib/quantity.ts`

```ts
export function formatQuantity(qty: number | null | undefined): string
```

Converts floats to human-readable fractions. Used in `RecipeDetailPage` and `ShoppingListDetailPage`.

### `AddToListDialog` (`frontend/src/components/AddToListDialog.tsx`)

- `ingredientIds` prop becomes `string[] | undefined`.
- When `undefined`, omit `ingredient_ids` from the request body (backend adds all).
- Dialog title: `"Add all ingredients to list"` when no IDs, `"Add N ingredients to list"` when IDs present.

### `RecipeCard` (`frontend/src/components/RecipeCard.tsx`)

- Outer `<Link>` becomes a `<div className="relative">` with an inner `<Link>` covering the card content.
- Cart icon button (`ShoppingCart` from lucide-react) added bottom-right, `absolute` positioned.
- `onClick`: `e.preventDefault(); e.stopPropagation();` then open `AddToListDialog` with `recipeId` (no `ingredientIds`).
- Card needs `recipeId` prop; `RecipeListPage` passes it.

### `RecipeDetailPage` (`frontend/src/pages/RecipeDetailPage.tsx`)

- Add a persistent `ShoppingCart` button in the header row alongside the Cook button.
- Opens `AddToListDialog` with `recipeId` and no `ingredientIds`.
- Existing checkbox-based "Add N to list" flow remains for partial selection.
- Replace `{ing.quantity}` display with `formatQuantity(ing.quantity)`.

### `ShoppingListDetailPage` (`frontend/src/pages/ShoppingListDetailPage.tsx`)

- Replace `{item.quantity}` display with `formatQuantity(item.quantity)`.
