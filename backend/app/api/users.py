from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from pydantic import BaseModel

router = APIRouter(prefix="/api/users", tags=["users"])

class UserOut(BaseModel):
    id: str
    name: str
    model_config = {"from_attributes": True}

@router.get("", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.household_id == current_user.household_id).order_by(User.name))
    return result.scalars().all()
