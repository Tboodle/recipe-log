from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.config import settings
from app.models import User, HouseholdInvite

router = APIRouter(prefix="/api/households", tags=["households"])


class InviteOut(BaseModel):
    invite_url: str
    token: str


class InviteInfo(BaseModel):
    household_name: str
    token: str


@router.post("/invite", response_model=InviteOut)
async def get_or_create_invite(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the household's invite link, creating the token if needed."""
    result = await db.execute(
        select(HouseholdInvite).where(HouseholdInvite.household_id == current_user.household_id)
    )
    invite = result.scalar_one_or_none()
    if not invite:
        invite = HouseholdInvite(household_id=current_user.household_id)
        db.add(invite)
        await db.commit()
        await db.refresh(invite)

    return InviteOut(
        token=invite.token,
        invite_url=f"{settings.frontend_url}/join/{invite.token}",
    )


@router.delete("/invite", status_code=204)
async def regenerate_invite(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete the current invite token so a fresh one will be created on next request."""
    result = await db.execute(
        select(HouseholdInvite).where(HouseholdInvite.household_id == current_user.household_id)
    )
    invite = result.scalar_one_or_none()
    if invite:
        await db.delete(invite)
        await db.commit()


@router.get("/invite/{token}", response_model=InviteInfo)
async def get_invite_info(token: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint — return household name for the join page."""
    result = await db.execute(
        select(HouseholdInvite).where(HouseholdInvite.token == token)
    )
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or expired")

    await db.refresh(invite, ["household"])
    return InviteInfo(household_name=invite.household.name, token=token)
