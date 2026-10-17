"""Authentication models and schemas."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel


@dataclass
class User:
    """User model."""
    id: str
    email: str
    name: str
    avatar_url: Optional[str] = None
    is_family_head: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "avatar_url": self.avatar_url,
            "is_family_head": self.is_family_head,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class TokenPair:
    """Access and refresh token pair."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 900  # 15 minutes


class TokenPayload(BaseModel):
    """JWT token payload."""
    sub: str  # user id
    email: str
    name: str
    iat: int
    exp: int
    type: str  # "access" or "refresh"


class LoginRequest(BaseModel):
    """Login request body."""
    email: str
    password: str  # In production, use OAuth instead


class AuthCallbackRequest(BaseModel):
    """OAuth callback request."""
    code: str
    state: str


class AuthResponse(BaseModel):
    """Auth response."""
    user: User
    tokens: TokenPair


class RefreshRequest(BaseModel):
    """Token refresh request."""
    refresh_token: str


class RefreshResponse(BaseModel):
    """Token refresh response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 900


class UserResponse(BaseModel):
    """Current user response."""
    id: str
    email: str
    name: str
    avatar_url: Optional[str] = None
    is_family_head: bool = False


class LogoutResponse(BaseModel):
    """Logout response."""
    message: str = "Successfully logged out"