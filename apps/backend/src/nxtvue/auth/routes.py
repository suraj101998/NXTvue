"""Authentication API routes."""

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Cookie
from fastapi.responses import RedirectResponse
from pydantic import EmailStr

from .models import (
    User, TokenPair, AuthResponse, RefreshRequest, RefreshResponse,
    UserResponse, LogoutResponse, AuthCallbackRequest
)
from .service import auth_service
from .dependencies import get_current_user, get_current_user_optional


router = APIRouter(prefix="/auth", tags=["authentication"])


@router.get("/login")
async def login(
    response: Response,
    redirect_url: str = "/dashboard",
):
    """
    Initiate INDmoney OAuth login flow.
    In production, redirect to INDmoney OAuth endpoint.
    """
    # Generate OAuth state
    state = auth_service.generate_oauth_state(redirect_url)

    # In production, redirect to:
    # https://auth.indmoney.com/oauth/authorize?
    #   client_id={CLIENT_ID}&
    #   redirect_uri={REDIRECT_URI}&
    #   response_type=code&
    #   scope=portfolio:read&
    #   state={state}

    # For development, return the state and mock redirect
    return {
        "message": "Redirect to INDmoney OAuth",
        "oauth_url": f"https://auth.indmoney.com/oauth/authorize?client_id=dev&redirect_uri=http://localhost:8000/api/v1/auth/callback&response_type=code&scope=portfolio:read&state={state}",
        "state": state,
        "dev_note": "In development, use /auth/dev-login for testing",
    }


@router.post("/dev-login")
async def dev_login(
    response: Response,
    email: EmailStr = "test@example.com",
    name: str = "Test User",
    is_family_head: bool = False,
):
    """
    Development-only login endpoint.
    Creates a test user and sets auth cookies.
    """
    user = User(
        id=f"dev_{email.split('@')[0]}",
        email=email,
        name=name,
        is_family_head=is_family_head,
    )

    tokens = auth_service.create_token_pair(user)

    # Set HttpOnly cookies
    _set_auth_cookies(response, tokens)

    return AuthResponse(user=user, tokens=tokens)


@router.get("/callback")
async def auth_callback(
    response: Response,
    code: str,
    state: str,
):
    """
    Handle OAuth callback from INDmoney.
    Exchange code for tokens and create user session.
    """
    # Verify state
    redirect_url = auth_service.verify_oauth_state(state)
    if not redirect_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        )

    # In production, exchange code for tokens with INDmoney:
    # token_response = await http_client.post(
    #     "https://auth.indmoney.com/oauth/token",
    #     data={
    #         "grant_type": "authorization_code",
    #         "code": code,
    #         "redirect_uri": REDIRECT_URI,
    #         "client_id": CLIENT_ID,
    #         "client_secret": CLIENT_SECRET,
    #     }
    # )
    # indmoney_user = await get_indmoney_user(token_response.access_token)

    # For development, create mock user
    indmoney_user = {
        "user_id": f"ind_{code[:8]}",
        "email": "user@indmoney.com",
        "name": "INDmoney User",
        "is_family_head": True,
    }

    user = auth_service.create_user_from_indmoney(indmoney_user)
    tokens = auth_service.create_token_pair(user)

    _set_auth_cookies(response, tokens)

    # Redirect to frontend
    return RedirectResponse(url=redirect_url, status_code=302)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(
    response: Response,
    request: RefreshRequest,
    refresh_token_cookie: Optional[str] = Cookie(None, alias="refresh_token"),
):
    """Refresh access token using refresh token."""
    refresh_token = request.refresh_token or refresh_token_cookie

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required",
        )

    result = auth_service.refresh_access_token(refresh_token)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Set new access token cookie
    response.set_cookie(
        key="access_token",
        value=result.access_token,
        httponly=True,
        secure=True,  # Set to False for local development
        samesite="lax",
        max_age=900,  # 15 minutes
    )

    return result


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        is_family_head=current_user.is_family_head,
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    response: Response,
    access_token: Optional[str] = Cookie(None, alias="access_token"),
    refresh_token: Optional[str] = Cookie(None, alias="refresh_token"),
):
    """Logout user and revoke tokens."""
    # Blacklist access token
    if access_token:
        auth_service.blacklist_access_token(access_token)

    # Revoke refresh token
    if refresh_token:
        auth_service.revoke_refresh_token(refresh_token)

    # Clear cookies
    _clear_auth_cookies(response)

    return LogoutResponse()


@router.get("/status")
async def auth_status(current_user: Optional[User] = Depends(get_current_user_optional)):
    """Check authentication status."""
    if current_user:
        return {
            "authenticated": True,
            "user": {
                "id": current_user.id,
                "email": current_user.email,
                "name": current_user.name,
                "is_family_head": current_user.is_family_head,
            },
        }
    return {"authenticated": False}


def _set_auth_cookies(response: Response, tokens: TokenPair):
    """Set authentication cookies."""
    # Access token - short lived
    response.set_cookie(
        key="access_token",
        value=tokens.access_token,
        httponly=True,
        secure=True,  # Set to False for local development
        samesite="lax",
        max_age=tokens.expires_in,
        path="/",
    )

    # Refresh token - long lived
    response.set_cookie(
        key="refresh_token",
        value=tokens.refresh_token,
        httponly=True,
        secure=True,  # Set to False for local development
        samesite="lax",
        max_age=60 * 60 * 24 * 7,  # 7 days
        path="/",
    )


def _clear_auth_cookies(response: Response):
    """Clear authentication cookies."""
    response.delete_cookie(key="access_token", path="/", httponly=True, secure=True, samesite="lax")
    response.delete_cookie(key="refresh_token", path="/", httponly=True, secure=True, samesite="lax")