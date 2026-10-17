"""FastAPI authentication dependencies."""

from typing import Optional
from fastapi import Depends, HTTPException, status, Request, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .service import auth_service
from .models import User, TokenPayload


security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token: Optional[str] = Cookie(None, alias="access_token"),
) -> User:
    """
    Get current authenticated user from JWT token.
    Supports both Authorization header and HttpOnly cookie.
    """
    token = None

    # Try Authorization header first
    if credentials:
        token = credentials.credentials
    # Fallback to cookie
    elif access_token:
        token = access_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = auth_service.verify_token(token, "access")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return User(
        id=payload.sub,
        email=payload.email,
        name=payload.name,
    )


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token: Optional[str] = Cookie(None, alias="access_token"),
) -> Optional[User]:
    """
    Get current user if authenticated, otherwise return None.
    Useful for endpoints that work with or without authentication.
    """
    token = None

    if credentials:
        token = credentials.credentials
    elif access_token:
        token = access_token

    if not token:
        return None

    payload = auth_service.verify_token(token, "access")
    if not payload:
        return None

    return User(
        id=payload.sub,
        email=payload.email,
        name=payload.name,
    )


async def require_family_head(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require user to be family head."""
    if not current_user.is_family_head:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Family head access required",
        )
    return current_user