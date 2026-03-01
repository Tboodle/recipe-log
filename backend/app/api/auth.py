import secrets
import uuid
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Household, User, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    household = Household(id=str(uuid.uuid4()), name=body.household_name)
    db.add(household)

    user = User(
        id=str(uuid.uuid4()),
        household_id=household.id,
        email=body.email,
        name=body.name,
        hashed_password=hash_password(body.password),
        role=UserRole.admin,
    )
    db.add(user)
    await db.commit()

    token = create_access_token({"sub": user.id, "household_id": household.id})
    return TokenResponse(access_token=token)

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.id, "household_id": user.household_id})
    return TokenResponse(access_token=token)

@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role.value,
        household_id=current_user.household_id,
    )


@router.get("/google")
async def google_login():
    """Redirect the browser to Google's OAuth consent screen."""
    if not settings.google_client_id:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    state = secrets.token_urlsafe(16)
    params = urlencode({
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
    })
    response = RedirectResponse(f"{_GOOGLE_AUTH_URL}?{params}")
    response.set_cookie("oauth_state", state, httponly=True, max_age=600, samesite="lax")
    return response


@router.get("/google/callback")
async def google_callback(
    code: str,
    state: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle the redirect back from Google, create/find the user, issue a JWT."""
    cookie_state = request.cookies.get("oauth_state")
    if not cookie_state or cookie_state != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    async with httpx.AsyncClient() as client:
        # Exchange authorization code for tokens
        token_resp = await client.post(_GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        })
        token_data = token_resp.json()
        google_access_token = token_data.get("access_token")
        if not google_access_token:
            raise HTTPException(status_code=400, detail="Failed to obtain Google access token")

        # Fetch the user's profile
        userinfo_resp = await client.get(
            _GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {google_access_token}"},
        )
        userinfo = userinfo_resp.json()

    google_id: str = userinfo.get("id", "")
    email: str = userinfo.get("email", "")
    name: str = userinfo.get("name") or (email.split("@")[0] if email else "User")

    if not google_id or not email:
        raise HTTPException(status_code=400, detail="Could not retrieve profile from Google")

    # Find by google_id → fall back to email match (links an existing account)
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if not user:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user:
            user.google_id = google_id  # link the existing account
        else:
            # First-time sign-in: create a household + admin user
            household = Household(id=str(uuid.uuid4()), name=f"{name}'s Kitchen")
            db.add(household)
            user = User(
                id=str(uuid.uuid4()),
                household_id=household.id,
                email=email,
                name=name,
                google_id=google_id,
                role=UserRole.admin,
            )
            db.add(user)

        await db.commit()

    jwt_token = create_access_token({"sub": user.id, "household_id": user.household_id})
    response = RedirectResponse(f"{settings.frontend_url}/auth/callback?token={jwt_token}")
    response.delete_cookie("oauth_state")
    return response
