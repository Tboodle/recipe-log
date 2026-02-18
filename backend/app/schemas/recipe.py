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

    model_config = {"from_attributes": True}

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

    model_config = {"from_attributes": True}
