from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, ShoppingList, ShoppingItem, Ingredient
from app.schemas.shopping import ShoppingListIn, ShoppingListOut, ShoppingItemIn, AddFromRecipeRequest
import uuid

router = APIRouter(prefix="/api/shopping", tags=["shopping"])

async def _get_list_with_items(db: AsyncSession, list_id: str, household_id: str) -> ShoppingList:
    result = await db.execute(
        select(ShoppingList)
        .options(selectinload(ShoppingList.items))
        .where(ShoppingList.id == list_id, ShoppingList.household_id == household_id)
    )
    sl = result.scalar_one_or_none()
    if not sl:
        raise HTTPException(status_code=404, detail="List not found")
    return sl

@router.get("", response_model=list[ShoppingListOut])
async def list_shopping_lists(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(ShoppingList)
        .options(selectinload(ShoppingList.items))
        .where(ShoppingList.household_id == current_user.household_id)
        .order_by(ShoppingList.created_at.desc())
    )
    return result.scalars().all()

@router.post("", response_model=ShoppingListOut, status_code=201)
async def create_list(body: ShoppingListIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    sl = ShoppingList(id=str(uuid.uuid4()), household_id=current_user.household_id, name=body.name)
    db.add(sl)
    await db.commit()
    result = await db.execute(
        select(ShoppingList).options(selectinload(ShoppingList.items)).where(ShoppingList.id == sl.id)
    )
    return result.scalar_one()

@router.get("/{list_id}", response_model=ShoppingListOut)
async def get_list(list_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return await _get_list_with_items(db, list_id, current_user.household_id)

@router.post("/{list_id}/items", response_model=ShoppingListOut, status_code=201)
async def add_item(list_id: str, body: ShoppingItemIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _get_list_with_items(db, list_id, current_user.household_id)  # verify ownership
    item = ShoppingItem(id=str(uuid.uuid4()), list_id=list_id, **body.model_dump())
    db.add(item)
    await db.commit()
    return await _get_list_with_items(db, list_id, current_user.household_id)

@router.post("/{list_id}/add-from-recipe", response_model=ShoppingListOut)
async def add_from_recipe(list_id: str, body: AddFromRecipeRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _get_list_with_items(db, list_id, current_user.household_id)  # verify ownership
    result = await db.execute(
        select(Ingredient).where(
            Ingredient.id.in_(body.ingredient_ids),
            Ingredient.recipe_id == body.recipe_id,
        )
    )
    for ing in result.scalars().all():
        db.add(ShoppingItem(
            id=str(uuid.uuid4()),
            list_id=list_id,
            recipe_id=body.recipe_id,
            ingredient_name=ing.name,
            quantity=ing.quantity,
            unit=ing.unit,
        ))
    await db.commit()
    return await _get_list_with_items(db, list_id, current_user.household_id)

@router.patch("/{list_id}/items/{item_id}/check", response_model=ShoppingListOut)
async def toggle_item(list_id: str, item_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await _get_list_with_items(db, list_id, current_user.household_id)  # verify ownership
    result = await db.execute(select(ShoppingItem).where(ShoppingItem.id == item_id, ShoppingItem.list_id == list_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.checked = not item.checked
    await db.commit()
    return await _get_list_with_items(db, list_id, current_user.household_id)

@router.delete("/{list_id}", status_code=204)
async def delete_list(list_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(ShoppingList).where(ShoppingList.id == list_id, ShoppingList.household_id == current_user.household_id)
    )
    sl = result.scalar_one_or_none()
    if not sl:
        raise HTTPException(status_code=404, detail="List not found")
    await db.delete(sl)
    await db.commit()
