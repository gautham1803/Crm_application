"""Acufy CRM — FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.events import event_bus
from app.core.websocket import ws_manager

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle."""
    logger.info("Acufy CRM starting up...")
    # Connect Redis event bus
    await event_bus.connect()
    await ws_manager.connect_redis()
    logger.info("Redis connected")

    yield

    # Shutdown
    logger.info("Acufy CRM shutting down...")
    await event_bus.disconnect()
    await ws_manager.disconnect_redis()


app = FastAPI(
    title="Acufy CRM API",
    description="AI-Powered Sales CRM with Agentic Swarm",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health check ────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": "acufy-crm"}


# ── Dev auth info (only in dev mode) ────────────────────────
@app.get("/api/v1/auth/dev-users", tags=["auth"])
async def get_dev_users() -> dict[str, object]:
    """Return available dev users (only when DEV_AUTH_BYPASS=true)."""
    if not settings.dev_auth_bypass:
        return {"enabled": False, "users": []}

    from app.core.auth import DEV_USERS
    return {
        "enabled": True,
        "users": [
            {"key": k, "email": v["email"], "name": v["name"], "role": v["role"]}
            for k, v in DEV_USERS.items()
        ],
    }


# ── Import routers (lazy to avoid circular imports) ────────
def _include_routers() -> None:
    from app.routers import accounts, contacts, deals, products, activities, tasks
    from app.routers import import_export, webhooks, agent, ws, messaging

    prefix = "/api/v1"
    app.include_router(accounts.router, prefix=prefix, tags=["accounts"])
    app.include_router(contacts.router, prefix=prefix, tags=["contacts"])
    app.include_router(deals.router, prefix=prefix, tags=["deals"])
    app.include_router(products.router, prefix=prefix, tags=["products"])
    app.include_router(activities.router, prefix=prefix, tags=["activities"])
    app.include_router(tasks.router, prefix=prefix, tags=["tasks"])
    app.include_router(import_export.router, prefix=prefix, tags=["import/export"])
    app.include_router(webhooks.router, prefix=prefix, tags=["webhooks"])
    app.include_router(agent.router, prefix=prefix, tags=["ai"])
    app.include_router(messaging.router, prefix=prefix, tags=["messaging"])
    app.include_router(ws.router, tags=["websocket"])

_include_routers()
