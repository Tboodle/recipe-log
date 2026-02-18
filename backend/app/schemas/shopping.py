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
    ingredient_ids: list[str]
