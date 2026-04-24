"""Deals CRUD router with stage transition, stakeholders, and line items."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.events import event_bus
from app.core.websocket import ws_manager
from app.models.activity import Activity
from app.models.deal import Deal
from app.models.deal_contact_role import DealContactRole
from app.models.deal_line_item import DealLineItem
from app.models.deal_stage import DealStage
from app.schemas.deal import (
    DealCreate,
    DealDetailResponse,
    DealResponse,
    DealStageResponse,
    DealStageTransition,
    DealUpdate,
    LineItemCreate,
    LineItemResponse,
    StakeholderRequest,
    StakeholderResponse,
)
from app.schemas.common import MessageResponse, PaginatedResponse
from app.services.audit_service import write_audit_log

router = APIRouter(prefix="/deals")


# ── Pipeline Stages ─────────────────────────────────────────
@router.get("/stages", response_model=list[DealStageResponse])
async def list_stages(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[DealStageResponse]:
    result = await session.execute(
        select(DealStage).where(DealStage.deleted_at.is_(None)).order_by(DealStage.position)
    )
    stages = result.scalars().all()
    return [DealStageResponse.model_validate(s) for s in stages]


# ── Deals CRUD ──────────────────────────────────────────────
@router.get("", response_model=PaginatedResponse[DealResponse])
async def list_deals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    stage_id: UUID | None = None,
    owner_user_id: UUID | None = None,
    search: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[DealResponse]:
    query = select(Deal).where(Deal.deleted_at.is_(None))
    count_query = select(func.count(Deal.id)).where(Deal.deleted_at.is_(None))

    if stage_id:
        query = query.where(Deal.stage_id == stage_id)
        count_query = count_query.where(Deal.stage_id == stage_id)
    if owner_user_id:
        query = query.where(Deal.owner_user_id == owner_user_id)
        count_query = count_query.where(Deal.owner_user_id == owner_user_id)
    if search:
        query = query.where(Deal.name.ilike(f"%{search}%"))
        count_query = count_query.where(Deal.name.ilike(f"%{search}%"))

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await session.execute(
        query.offset(offset).limit(page_size).order_by(Deal.created_at.desc())
    )
    deals = result.scalars().all()

    items = []
    for d in deals:
        resp = DealResponse.model_validate(d)
        if d.stage:
            resp.stage = DealStageResponse.model_validate(d.stage)
        items.append(resp)

    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/{deal_id}", response_model=DealDetailResponse)
async def get_deal(
    deal_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> DealDetailResponse:
    deal = await session.get(Deal, deal_id)
    if not deal or deal.deleted_at:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Activity count
    act_count_result = await session.execute(
        select(func.count(Activity.id)).where(Activity.deal_id == deal_id)
    )

    resp = DealDetailResponse.model_validate(deal)
    resp.activities_count = act_count_result.scalar() or 0
    if deal.stage:
        resp.stage = DealStageResponse.model_validate(deal.stage)
    if deal.owner:
        resp.owner_name = deal.owner.name
    if deal.contact:
        resp.contact_name = f"{deal.contact.first_name} {deal.contact.last_name}"
    if deal.account:
        resp.account_name = deal.account.name

    # Stakeholders
    for s in deal.stakeholders:
        contact_name = None
        if s.contact:
            contact_name = f"{s.contact.first_name} {s.contact.last_name}"
        resp.stakeholders.append(StakeholderResponse(
            id=s.id, contact_id=s.contact_id, contact_name=contact_name, role=s.role.value
        ))

    # Line items
    for li in deal.line_items:
        product_name = li.product.name if li.product else None
        resp.line_items.append(LineItemResponse(
            id=li.id,
            product_id=li.product_id,
            product_name=product_name,
            quantity=li.quantity,
            unit_price=float(li.unit_price),
            currency=li.currency,
            total=float(li.unit_price) * li.quantity,
        ))

    return resp


@router.post("", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(
    data: DealCreate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> DealResponse:
    if not data.contact_id and not data.account_id:
        raise HTTPException(
            status_code=400,
            detail="At least one of contact_id or account_id must be set",
        )

    deal = Deal(team_id=user.team_id, **data.model_dump())
    session.add(deal)
    await session.flush()

    await write_audit_log(
        session,
        team_id=user.team_id,
        action="deal.created",
        entity_type="deal",
        entity_id=deal.id,
        after_state=data.model_dump(mode="json"),
    )

    await event_bus.publish(
        "deal.created",
        {"deal_id": str(deal.id), "stage_id": str(data.stage_id)},
        team_id=user.team_id,
    )

    await session.refresh(deal)
    return DealResponse.model_validate(deal)


@router.put("/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: UUID,
    data: DealUpdate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> DealResponse:
    deal = await session.get(Deal, deal_id)
    if not deal or deal.deleted_at:
        raise HTTPException(status_code=404, detail="Deal not found")

    update_data = data.model_dump(exclude_unset=True)
    before = {"name": deal.name, "amount": float(deal.amount or 0)}
    for key, value in update_data.items():
        setattr(deal, key, value)

    await write_audit_log(
        session,
        team_id=user.team_id,
        action="deal.updated",
        entity_type="deal",
        entity_id=deal_id,
        before_state=before,
        after_state=data.model_dump(mode="json", exclude_unset=True),
    )

    await session.flush()
    await session.refresh(deal)
    return DealResponse.model_validate(deal)


@router.delete("/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deal(
    deal_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    deal = await session.get(Deal, deal_id)
    if not deal or deal.deleted_at:
        raise HTTPException(status_code=404, detail="Deal not found")

    deal.deleted_at = datetime.utcnow()
    await write_audit_log(
        session, team_id=user.team_id, action="deal.deleted",
        entity_type="deal", entity_id=deal_id,
    )
    await session.flush()


# ── Stage Transition ────────────────────────────────────────
@router.put("/{deal_id}/stage", response_model=DealResponse)
async def transition_stage(
    deal_id: UUID,
    data: DealStageTransition,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> DealResponse:
    deal = await session.get(Deal, deal_id)
    if not deal or deal.deleted_at:
        raise HTTPException(status_code=404, detail="Deal not found")

    new_stage = await session.get(DealStage, data.stage_id)
    if not new_stage:
        raise HTTPException(status_code=400, detail="Invalid stage_id")

    old_stage_id = deal.stage_id
    old_stage = deal.stage

    deal.stage_id = data.stage_id

    await write_audit_log(
        session,
        team_id=user.team_id,
        action="deal.stage_changed",
        entity_type="deal",
        entity_id=deal_id,
        before_state={"stage_id": str(old_stage_id), "stage_name": old_stage.name if old_stage else ""},
        after_state={"stage_id": str(data.stage_id), "stage_name": new_stage.name},
    )

    # Determine event
    event_type = "deal.stage_changed"
    if new_stage.is_won:
        event_type = "deal.won"
    elif new_stage.is_lost:
        event_type = "deal.lost"

    await event_bus.publish(
        event_type,
        {"deal_id": str(deal_id), "new_stage": new_stage.name, "old_stage": old_stage.name if old_stage else ""},
        team_id=user.team_id,
    )

    await ws_manager.publish_deal_stage_changed(deal_id, {
        "deal_id": str(deal_id),
        "new_stage": new_stage.name,
        "old_stage": old_stage.name if old_stage else "",
    })

    await session.flush()
    await session.refresh(deal)
    return DealResponse.model_validate(deal)


# ── Stakeholders (B2B) ─────────────────────────────────────
@router.post("/{deal_id}/stakeholders", response_model=StakeholderResponse)
async def add_stakeholder(
    deal_id: UUID,
    data: StakeholderRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> StakeholderResponse:
    deal = await session.get(Deal, deal_id)
    if not deal or deal.deleted_at:
        raise HTTPException(status_code=404, detail="Deal not found")
    if not deal.account_id:
        raise HTTPException(status_code=400, detail="Stakeholders only for B2B deals")

    from app.models.deal_contact_role import ContactRoleType
    role = DealContactRole(
        team_id=user.team_id,
        deal_id=deal_id,
        contact_id=data.contact_id,
        role=ContactRoleType(data.role),
    )
    session.add(role)
    await session.flush()
    await session.refresh(role)
    return StakeholderResponse(
        id=role.id, contact_id=role.contact_id, role=role.role.value
    )


@router.delete("/{deal_id}/stakeholders/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_stakeholder(
    deal_id: UUID,
    role_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    role = await session.get(DealContactRole, role_id)
    if not role or role.deal_id != deal_id:
        raise HTTPException(status_code=404, detail="Stakeholder not found")
    await session.delete(role)
    await session.flush()


# ── Line Items ──────────────────────────────────────────────
@router.post("/{deal_id}/line-items", response_model=LineItemResponse)
async def add_line_item(
    deal_id: UUID,
    data: LineItemCreate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> LineItemResponse:
    deal = await session.get(Deal, deal_id)
    if not deal or deal.deleted_at:
        raise HTTPException(status_code=404, detail="Deal not found")

    li = DealLineItem(
        team_id=user.team_id,
        deal_id=deal_id,
        product_id=data.product_id,
        quantity=data.quantity,
        unit_price=data.unit_price,
        currency=data.currency,
    )
    session.add(li)
    await session.flush()
    await session.refresh(li)

    return LineItemResponse(
        id=li.id,
        product_id=li.product_id,
        quantity=li.quantity,
        unit_price=float(li.unit_price),
        currency=li.currency,
        total=float(li.unit_price) * li.quantity,
    )


@router.delete("/{deal_id}/line-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_line_item(
    deal_id: UUID,
    item_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    li = await session.get(DealLineItem, item_id)
    if not li or li.deal_id != deal_id:
        raise HTTPException(status_code=404, detail="Line item not found")
    await session.delete(li)
    await session.flush()
