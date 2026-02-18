from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, Tag
from app.schemas.tag import TagIn, TagOut
import uuid

router = APIRouter(prefix="/api/tags", tags=["tags"])

@router.get("", response_model=list[TagOut])
async def list_tags(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Tag).where(Tag.household_id == current_user.household_id).order_by(Tag.name)
    )
    return result.scalars().all()

@router.post("", response_model=TagOut, status_code=201)
async def create_tag(body: TagIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    tag = Tag(id=str(uuid.uuid4()), household_id=current_user.household_id, **body.model_dump())
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag

@router.put("/{tag_id}", response_model=TagOut)
async def update_tag(tag_id: str, body: TagIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Tag).where(Tag.id == tag_id, Tag.household_id == current_user.household_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    tag.name = body.name
    tag.color = body.color
    await db.commit()
    return tag

@router.delete("/{tag_id}", status_code=204)
async def delete_tag(tag_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Tag).where(Tag.id == tag_id, Tag.household_id == current_user.household_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    await db.delete(tag)
    await db.commit()
