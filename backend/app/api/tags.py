from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Tag, Recipe, RecipeTag
from app.schemas.tag import TagIn, TagOut
from app.schemas.recipe import RecipeOut
import uuid

router = APIRouter(prefix="/api/tags", tags=["tags"])

_CATEGORY_COLORS: dict[str, str] = {
    "meal_type": "#f59e0b",  # amber
    "protein":   "#f43f5e",  # rose
    "cuisine":   "#7c3aed",  # violet
    "custom":    "#84cc16",  # lime
}


async def _get_or_create_tag(db: AsyncSession, household_id: str, tag_in: TagIn) -> Tag:
    result = await db.execute(
        select(Tag).where(Tag.household_id == household_id, Tag.name == tag_in.name)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        tag = Tag(
            id=str(uuid.uuid4()),
            household_id=household_id,
            name=tag_in.name,
            category=tag_in.category,
            color=_CATEGORY_COLORS.get(tag_in.category, "#84cc16"),
        )
        db.add(tag)
        await db.flush()
    return tag


@router.get("", response_model=list[TagOut])
async def list_tags(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Tag)
        .where(Tag.household_id == current_user.household_id)
        .order_by(Tag.category, Tag.name)
    )
    return result.scalars().all()


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(tag_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Tag).where(Tag.id == tag_id, Tag.household_id == current_user.household_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    await db.delete(tag)
    await db.commit()


# ---- Recipe tag management ----

@router.put("/recipes/{recipe_id}", response_model=RecipeOut)
async def update_recipe_tags(
    recipe_id: str,
    tags: list[TagIn],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace all tags on a recipe. Accepts [{name, category}]; tags are get-or-created."""
    result = await db.execute(
        select(Recipe)
        .options(selectinload(Recipe.ingredients), selectinload(Recipe.steps), selectinload(Recipe.tags))
        .where(Recipe.id == recipe_id, Recipe.household_id == current_user.household_id)
    )
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    resolved: list[Tag] = []
    for tag_in in tags:
        tag = await _get_or_create_tag(db, current_user.household_id, tag_in)
        resolved.append(tag)

    await db.execute(delete(RecipeTag).where(RecipeTag.recipe_id == recipe_id))
    for tag in resolved:
        db.add(RecipeTag(recipe_id=recipe_id, tag_id=tag.id))

    await db.commit()

    # Expunge the recipe from the identity map so the next SELECT fetches
    # a completely fresh copy from the DB (avoids selectinload skipping the
    # secondary tags query because it sees the relationship was already loaded).
    db.expunge(recipe)
    result = await db.execute(
        select(Recipe)
        .options(selectinload(Recipe.ingredients), selectinload(Recipe.steps), selectinload(Recipe.tags))
        .where(Recipe.id == recipe_id, Recipe.household_id == current_user.household_id)
    )
    return result.scalar_one()
