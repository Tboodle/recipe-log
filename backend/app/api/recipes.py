from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, delete
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Recipe, Ingredient, Step, Tag, RecipeTag
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
    await db.flush()  # flush so recipe.id is persisted and identity established

    for i, ing in enumerate(body.ingredients):
        db.add(Ingredient(id=str(uuid.uuid4()), recipe_id=recipe.id, **ing.model_dump(exclude={"order"}), order=i))
    for i, step in enumerate(body.steps):
        db.add(Step(id=str(uuid.uuid4()), recipe_id=recipe.id, **step.model_dump(exclude={"order"}), order=i))

    if body.tag_ids:
        for tag_id in body.tag_ids:
            db.add(RecipeTag(recipe_id=recipe.id, tag_id=tag_id))

    await db.commit()

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

    for ing in list(recipe.ingredients):
        await db.delete(ing)
    for step in list(recipe.steps):
        await db.delete(step)
    await db.flush()

    for i, ing in enumerate(body.ingredients):
        db.add(Ingredient(id=str(uuid.uuid4()), recipe_id=recipe.id, **ing.model_dump(exclude={"order"}), order=i))
    for i, step in enumerate(body.steps):
        db.add(Step(id=str(uuid.uuid4()), recipe_id=recipe.id, **step.model_dump(exclude={"order"}), order=i))

    if body.tag_ids is not None:
        # Delete existing tag associations and re-insert
        await db.execute(delete(RecipeTag).where(RecipeTag.recipe_id == recipe_id))
        for tag_id in body.tag_ids:
            db.add(RecipeTag(recipe_id=recipe.id, tag_id=tag_id))

    await db.commit()
    result = await db.execute(_recipe_with_relations().where(Recipe.id == recipe_id))
    return result.scalar_one()

@router.delete("/{recipe_id}", status_code=204)
async def delete_recipe(
    recipe_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Recipe).where(Recipe.id == recipe_id, Recipe.household_id == current_user.household_id)
    )
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    await db.delete(recipe)
    await db.commit()
