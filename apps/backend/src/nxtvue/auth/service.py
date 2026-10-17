"""Authentication service with JWT token management."""

import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import jwt, JWTError
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

from .models import User, TokenPair, TokenPayload, AuthResponse, RefreshResponse


class AuthService:
    """Handles authentication, token generation, and validation."""

    # Token configuration
    ACCESS_TOKEN_EXPIRE_MINUTES = 15
    REFRESH_TOKEN_EXPIRE_DAYS = 7
    ALGORITHM = "RS256"

    def __init__(self):
        self._private_key: Optional[rsa.RSAPrivateKey] = None
        self._public_key: Optional[rsa.RSAPublicKey] = None
        self._load_or_generate_keys()

        # In-memory token blacklist (use Redis in production)
        self._blacklisted_tokens: set = set()

        # Refresh token storage (use Redis/database in production)
        self._refresh_tokens: Dict[str, Dict[str, Any]] = {}

        # OAuth state storage (use Redis in production)
        self._oauth_states: Dict[str, Dict[str, Any]] = {}

    def _load_or_generate_keys(self):
        """Load RSA keys from environment or generate new ones."""
        private_key_pem = os.getenv("JWT_PRIVATE_KEY")
        public_key_pem = os.getenv("JWT_PUBLIC_KEY")

        if private_key_pem and public_key_pem:
            self._private_key = serialization.load_pem_private_key(
                private_key_pem.encode(), password=None
            )
            self._public_key = serialization.load_pem_public_key(
                public_key_pem.encode()
            )
        else:
            # Generate new keys for development
            self._private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
            )
            self._public_key = self._private_key.public_key()

            # Print keys for .env configuration (development only)
            private_pem = self._private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            ).decode()

            public_pem = self._public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            ).decode()

            print("\n=== DEVELOPMENT KEYS (add to .env) ===")
            print(f"JWT_PRIVATE_KEY='{private_pem.replace(chr(10), '\\n')}'")
            print(f"JWT_PUBLIC_KEY='{public_pem.replace(chr(10), '\\n')}'")
            print("======================================\n")

    def _get_private_key_pem(self) -> str:
        return self._private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode()

    def _get_public_key_pem(self) -> str:
        return self._public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode()

    def create_access_token(self, user: User) -> str:
        """Create JWT access token."""
        now = datetime.now(timezone.utc)
        expire = now + timedelta(minutes=self.ACCESS_TOKEN_EXPIRE_MINUTES)

        payload = {
            "sub": user.id,
            "email": user.email,
            "name": user.name,
            "iat": int(now.timestamp()),
            "exp": int(expire.timestamp()),
            "type": "access",
        }

        return jwt.encode(payload, self._get_private_key_pem(), algorithm=self.ALGORITHM)

    def create_refresh_token(self, user: User) -> str:
        """Create JWT refresh token."""
        now = datetime.now(timezone.utc)
        expire = now + timedelta(days=self.REFRESH_TOKEN_EXPIRE_DAYS)

        # Generate a random token ID for tracking
        token_id = secrets.token_urlsafe(32)

        payload = {
            "sub": user.id,
            "email": user.email,
            "name": user.name,
            "jti": token_id,  # JWT ID for revocation
            "iat": int(now.timestamp()),
            "exp": int(expire.timestamp()),
            "type": "refresh",
        }

        token = jwt.encode(payload, self._get_private_key_pem(), algorithm=self.ALGORITHM)

        # Store refresh token metadata
        self._refresh_tokens[token_id] = {
            "user_id": user.id,
            "created_at": now,
            "expires_at": expire,
            "revoked": False,
        }

        return token

    def create_token_pair(self, user: User) -> TokenPair:
        """Create access and refresh token pair."""
        return TokenPair(
            access_token=self.create_access_token(user),
            refresh_token=self.create_refresh_token(user),
            expires_in=self.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    def verify_token(self, token: str, token_type: str = "access") -> Optional[TokenPayload]:
        """Verify and decode JWT token."""
        try:
            payload = jwt.decode(
                token,
                self._get_public_key_pem(),
                algorithms=[self.ALGORITHM],
            )

            # Check token type
            if payload.get("type") != token_type:
                return None

            # Check if token is blacklisted
            if payload.get("jti") in self._blacklisted_tokens:
                return None

            # Check if refresh token is revoked
            if token_type == "refresh":
                jti = payload.get("jti")
                if jti and jti in self._refresh_tokens:
                    if self._refresh_tokens[jti].get("revoked"):
                        return None

            return TokenPayload(**payload)

        except JWTError:
            return None

    def refresh_access_token(self, refresh_token: str) -> Optional[RefreshResponse]:
        """Refresh access token using refresh token."""
        payload = self.verify_token(refresh_token, "refresh")
        if not payload:
            return None

        # Create new access token
        user = User(
            id=payload.sub,
            email=payload.email,
            name=payload.name,
        )
        new_access_token = self.create_access_token(user)

        return RefreshResponse(access_token=new_access_token)

    def revoke_refresh_token(self, refresh_token: str) -> bool:
        """Revoke a refresh token."""
        payload = self.verify_token(refresh_token, "refresh")
        if not payload:
            return False

        jti = payload.jti
        if jti and jti in self._refresh_tokens:
            self._refresh_tokens[jti]["revoked"] = True
            return True

        return False

    def blacklist_access_token(self, access_token: str) -> bool:
        """Add access token to blacklist (for logout)."""
        payload = self.verify_token(access_token, "access")
        if not payload:
            return False

        self._blacklisted_tokens.add(payload.jti or access_token)
        return True

    def generate_oauth_state(self, redirect_url: str) -> str:
        """Generate OAuth state parameter."""
        state = secrets.token_urlsafe(32)
        self._oauth_states[state] = {
            "redirect_url": redirect_url,
            "created_at": datetime.now(timezone.utc),
        }
        return state

    def verify_oauth_state(self, state: str) -> Optional[str]:
        """Verify and consume OAuth state."""
        if state not in self._oauth_states:
            return None

        data = self._oauth_states.pop(state)
        # Check expiry (10 minutes)
        if datetime.now(timezone.utc) - data["created_at"] > timedelta(minutes=10):
            return None

        return data["redirect_url"]

    def create_user_from_indmoney(self, indmoney_data: Dict[str, Any]) -> User:
        """Create or update user from INDmoney OAuth data."""
        return User(
            id=indmoney_data.get("user_id", indmoney_data.get("id")),
            email=indmoney_data.get("email", ""),
            name=indmoney_data.get("name", ""),
            avatar_url=indmoney_data.get("avatar_url"),
            is_family_head=indmoney_data.get("is_family_head", False),
        )

    def cleanup_expired_tokens(self):
        """Clean up expired tokens (run periodically)."""
        now = datetime.now(timezone.utc)

        # Clean refresh tokens
        expired = [
            jti for jti, data in self._refresh_tokens.items()
            if data["expires_at"] < now
        ]
        for jti in expired:
            del self._refresh_tokens[jti]

        # Clean OAuth states
        expired_states = [
            state for state, data in self._oauth_states.items()
            if now - data["created_at"] > timedelta(minutes=10)
        ]
        for state in expired_states:
            del self._oauth_states[state]


# Global auth service instance
auth_service = AuthService()