"""Accounts CRUD router."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.models.account import Account
from app.models.deal import Deal
from app.models.contact import Contact
from app.schemas.account import AccountCreate, AccountDetailResponse, AccountResponse, AccountUpdate
from app.schemas.common import PaginatedResponse
from app.services.audit_service import write_audit_log

router = APIRouter(prefix="/accounts")


@router.get("", response_model=PaginatedResponse[AccountResponse])
async def list_accounts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    industry: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[AccountResponse]:
    query = select(Account).where(Account.deleted_at.is_(None))
    count_query = select(func.count(Account.id)).where(Account.deleted_at.is_(None))

    if search:
        search_filter = Account.name.ilike(f"%{search}%") | Account.domain.ilike(f"%{search}%")
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if industry:
        query = query.where(Account.industry == industry)
        count_query = count_query.where(Account.industry == industry)

    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Account.created_at.desc())
    result = await session.execute(query)
    accounts = result.scalars().all()

    return PaginatedResponse.create(
        items=[AccountResponse.model_validate(a) for a in accounts],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{account_id}", response_model=AccountDetailResponse)
async def get_account(
    account_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AccountDetailResponse:
    account = await session.get(Account, account_id)
    if not account or account.deleted_at:
        raise HTTPException(status_code=404, detail="Account not found")

    # Contacts count
    contacts_result = await session.execute(
        select(func.count(Contact.id)).where(
            Contact.account_id == account_id,
            Contact.deleted_at.is_(None),
        )
    )
    contacts_count = contacts_result.scalar() or 0

    # Deals rollup
    deals_result = await session.execute(
        select(Deal).where(
            Deal.account_id == account_id,
            Deal.deleted_at.is_(None),
        )
    )
    deals = deals_result.scalars().all()
    total_amount = sum(float(d.amount or 0) for d in deals)
    deals_by_stage: dict[str, float] = {}
    for d in deals:
        stage_name = d.stage.name if d.stage else "Unknown"
        deals_by_stage[stage_name] = deals_by_stage.get(stage_name, 0) + float(d.amount or 0)

    resp = AccountDetailResponse.model_validate(account)
    resp.contacts_count = contacts_count
    resp.deals_total_amount = total_amount
    resp.deals_by_stage = deals_by_stage
    return resp


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AccountResponse:
    account = Account(
        team_id=user.team_id,
        **data.model_dump(exclude_unset=True),
    )
    session.add(account)
    await session.flush()

    await write_audit_log(
        session,
        team_id=user.team_id,
        action="account.created",
        entity_type="account",
        entity_id=account.id,
        user_id=None,
        after_state=data.model_dump(mode="json"),
    )

    await session.refresh(account)
    return AccountResponse.model_validate(account)


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: UUID,
    data: AccountUpdate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AccountResponse:
    account = await session.get(Account, account_id)
    if not account or account.deleted_at:
        raise HTTPException(status_code=404, detail="Account not found")

    before_state = {
        "name": account.name, "domain": account.domain,
        "industry": account.industry, "size": account.size,
    }

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(account, key, value)

    await write_audit_log(
        session,
        team_id=user.team_id,
        action="account.updated",
        entity_type="account",
        entity_id=account_id,
        before_state=before_state,
        after_state=data.model_dump(mode="json", exclude_unset=True),
    )

    await session.flush()
    await session.refresh(account)
    return AccountResponse.model_validate(account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    account = await session.get(Account, account_id)
    if not account or account.deleted_at:
        raise HTTPException(status_code=404, detail="Account not found")

    from datetime import datetime
    account.deleted_at = datetime.utcnow()

    await write_audit_log(
        session,
        team_id=user.team_id,
        action="account.deleted",
        entity_type="account",
        entity_id=account_id,
    )
    await session.flush()
