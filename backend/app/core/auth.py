"""Authentication — Dev bypass + Auth0 JWT validation."""

from __future__ import annotations

import functools
import time
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt

from app.core.config import settings
from app.core.database import current_team_id_ctx

# ── Dev bypass users ────────────────────────────────────────
DEV_USERS: dict[str, dict[str, Any]] = {
    "admin": {
        "sub": "dev|admin-001",
        "email": "admin@demo.com",
        "name": "Admin User",
        "team_id": "00000000-0000-0000-0000-000000000001",
        "role": "admin",
    },
    "rep": {
        "sub": "dev|rep-001",
        "email": "rep@demo.com",
        "name": "Sales Rep",
        "team_id": "00000000-0000-0000-0000-000000000001",
        "role": "rep",
    },
    "manager": {
        "sub": "dev|manager-001",
        "email": "manager@demo.com",
        "name": "Sales Manager",
        "team_id": "00000000-0000-0000-0000-000000000001",
        "role": "manager",
    },
}


@dataclass(frozen=True)
class CurrentUser:
    """Authenticated user info extracted from JWT or dev bypass."""

    sub: str
    email: str
    name: str
    team_id: UUID
    role: str  # "admin" | "manager" | "rep"
    user_id: UUID | None = field(default=None)


# ── JWKS cache (1-hour TTL) ─────────────────────────────────
_jwks_cache: dict[str, Any] | None = None
_jwks_cache_time: float = 0.0
JWKS_CACHE_TTL = 3600  # 1 hour


async def _get_jwks() -> dict[str, Any]:
    """Fetch JWKS from Auth0 with 1-hour cache."""
    global _jwks_cache, _jwks_cache_time
    now = time.time()
    if _jwks_cache is not None and (now - _jwks_cache_time) < JWKS_CACHE_TTL:
        return _jwks_cache

    url = f"https://{settings.auth0_domain}/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_cache_time = now
        return _jwks_cache


async def _decode_auth0_token(token: str) -> dict[str, Any]:
    """Validate and decode Auth0 JWT."""
    jwks = await _get_jwks()

    unverified_header = jwt.get_unverified_header(token)
    rsa_key: dict[str, str] = {}

    for key in jwks.get("keys", []):
        if key.get("kid") == unverified_header.get("kid"):
            rsa_key = {
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key["use"],
                "n": key["n"],
                "e": key["e"],
            }
            break

    if not rsa_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to find appropriate key",
        )

    payload: dict[str, Any] = jwt.decode(
        token,
        rsa_key,
        algorithms=["RS256"],
        audience=settings.auth0_audience,
        issuer=f"https://{settings.auth0_domain}/",
    )
    return payload


async def get_current_user(request: Request) -> CurrentUser:
    """FastAPI dependency: extract authenticated user and set RLS context.

    In dev mode with DEV_AUTH_BYPASS=true, accepts X-Dev-User header
    with value "admin", "rep", or "manager".
    """
    # ── Dev bypass ──────────────────────────────────────────
    if settings.dev_auth_bypass:
        dev_user_key = request.headers.get("X-Dev-User", "admin")
        dev_data = DEV_USERS.get(dev_user_key)
        if dev_data is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Unknown dev user: {dev_user_key}. Use: {list(DEV_USERS.keys())}",
            )
        team_id = UUID(dev_data["team_id"])
        current_team_id_ctx.set(team_id)
        return CurrentUser(
            sub=dev_data["sub"],
            email=dev_data["email"],
            name=dev_data["name"],
            team_id=team_id,
            role=dev_data["role"],
        )

    # ── Auth0 JWT ───────────────────────────────────────────
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    token = auth_header[7:]
    try:
        payload = await _decode_auth0_token(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        ) from exc

    app_metadata = payload.get("app_metadata", payload.get(
        f"https://{settings.auth0_domain}/app_metadata", {}
    ))

    team_id_str = app_metadata.get("team_id")
    if not team_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No team_id in token claims",
        )

    team_id = UUID(team_id_str)
    current_team_id_ctx.set(team_id)

    return CurrentUser(
        sub=payload.get("sub", ""),
        email=payload.get("email", ""),
        name=payload.get("name", payload.get("nickname", "")),
        team_id=team_id,
        role=app_metadata.get("role", "rep"),
    )


def require_role(*roles: str):  # noqa: ANN201
    """Dependency factory: restrict endpoint to specific roles."""

    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' not authorized. Required: {roles}",
            )
        return user

    return Depends(_check)
