"""Activities router."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.models.activity import Activity
from app.schemas.activity import ActivityCreate, ActivityResponse
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/activities")


@router.get("", response_model=PaginatedResponse[ActivityResponse])
async def list_activities(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    contact_id: UUID | None = None,
    account_id: UUID | None = None,
    deal_id: UUID | None = None,
    type: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[ActivityResponse]:
    from sqlalchemy import func
    query = select(Activity).where(Activity.deleted_at.is_(None))
    count_query = select(func.count(Activity.id)).where(Activity.deleted_at.is_(None))

    if contact_id:
        query = query.where(Activity.contact_id == contact_id)
        count_query = count_query.where(Activity.contact_id == contact_id)
    if account_id:
        query = query.where(Activity.account_id == account_id)
        count_query = count_query.where(Activity.account_id == account_id)
    if deal_id:
        query = query.where(Activity.deal_id == deal_id)
        count_query = count_query.where(Activity.deal_id == deal_id)
    if type:
        query = query.where(Activity.type == type)
        count_query = count_query.where(Activity.type == type)

    total = (await session.execute(count_query)).scalar() or 0
    offset = (page - 1) * page_size
    result = await session.execute(
        query.offset(offset).limit(page_size).order_by(Activity.occurred_at.desc())
    )
    activities = result.scalars().all()

    return PaginatedResponse.create(
        items=[ActivityResponse.model_validate(a) for a in activities],
        total=total, page=page, page_size=page_size,
    )


@router.post("", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
async def create_activity(
    data: ActivityCreate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ActivityResponse:
    from datetime import datetime
    from app.models.activity import ActivityType

    activity = Activity(
        team_id=user.team_id,
        type=ActivityType(data.type),
        contact_id=data.contact_id,
        account_id=data.account_id,
        deal_id=data.deal_id,
        subject=data.subject,
        body=data.body,
        occurred_at=data.occurred_at or datetime.utcnow(),
        ai_generated=data.ai_generated,
    )
    session.add(activity)
    await session.flush()
    await session.refresh(activity)
    return ActivityResponse.model_validate(activity)
