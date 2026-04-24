"""Agent / AI routes — runs, approvals, audit."""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.core.websocket import ws_manager
from app.models.agent_approval import AgentApproval, ApprovalStatus
from app.models.agent_run import AgentRun, AgentRunStatus
from app.models.audit_log import AuditLog
from app.schemas.agent import (
    AgentRunCreate,
    AgentRunDetailResponse,
    AgentRunResponse,
    AgentTaskResponse,
    ApprovalDecision,
    ApprovalResponse,
    AuditLogResponse,
)
from app.schemas.common import PaginatedResponse
from app.services.audit_service import write_audit_log

router = APIRouter(prefix="/ai")


# ── Agent Runs ──────────────────────────────────────────────
@router.post("/runs", response_model=AgentRunResponse, status_code=status.HTTP_201_CREATED)
async def create_run(
    data: AgentRunCreate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AgentRunResponse:
    """Start a new agent run."""
    run = AgentRun(
        team_id=user.team_id,
        user_id=user.user_id or UUID("00000000-0000-0000-0000-000000000010"),
        goal=data.goal,
        context=data.context,
        status=AgentRunStatus.running,
        started_at=datetime.utcnow(),
    )
    session.add(run)
    await session.flush()

    # TODO: Dispatch to LangGraph via background worker
    # For now, just create the run record

    await session.refresh(run)
    return AgentRunResponse.model_validate(run)


@router.get("/runs", response_model=PaginatedResponse[AgentRunResponse])
async def list_runs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    run_status: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[AgentRunResponse]:
    query = select(AgentRun).where(AgentRun.deleted_at.is_(None))
    count_query = select(func.count(AgentRun.id)).where(AgentRun.deleted_at.is_(None))

    if run_status:
        query = query.where(AgentRun.status == AgentRunStatus(run_status))
        count_query = count_query.where(AgentRun.status == AgentRunStatus(run_status))

    total = (await session.execute(count_query)).scalar() or 0
    offset = (page - 1) * page_size
    result = await session.execute(
        query.offset(offset).limit(page_size).order_by(AgentRun.started_at.desc())
    )
    runs = result.scalars().all()
    return PaginatedResponse.create(
        items=[AgentRunResponse.model_validate(r) for r in runs],
        total=total, page=page, page_size=page_size,
    )


@router.get("/runs/{run_id}", response_model=AgentRunDetailResponse)
async def get_run(
    run_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AgentRunDetailResponse:
    run = await session.get(AgentRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    resp = AgentRunDetailResponse.model_validate(run)
    resp.tasks = [AgentTaskResponse.model_validate(t) for t in run.tasks]
    return resp


@router.post("/runs/{run_id}/cancel", response_model=AgentRunResponse)
async def cancel_run(
    run_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> AgentRunResponse:
    run = await session.get(AgentRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status not in (AgentRunStatus.running, AgentRunStatus.awaiting_approval):
        raise HTTPException(status_code=400, detail="Run cannot be cancelled")

    run.status = AgentRunStatus.failed
    run.completed_at = datetime.utcnow()
    await session.flush()
    await session.refresh(run)
    return AgentRunResponse.model_validate(run)


# ── Approvals ───────────────────────────────────────────────
@router.get("/approvals", response_model=PaginatedResponse[ApprovalResponse])
async def list_approvals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    approval_status: str | None = "pending",
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[ApprovalResponse]:
    query = select(AgentApproval).where(AgentApproval.deleted_at.is_(None))
    count_query = select(func.count(AgentApproval.id)).where(
        AgentApproval.deleted_at.is_(None)
    )

    if approval_status:
        query = query.where(AgentApproval.status == ApprovalStatus(approval_status))
        count_query = count_query.where(
            AgentApproval.status == ApprovalStatus(approval_status)
        )

    total = (await session.execute(count_query)).scalar() or 0
    offset = (page - 1) * page_size
    result = await session.execute(
        query.offset(offset).limit(page_size).order_by(AgentApproval.created_at.desc())
    )
    approvals = result.scalars().all()

    now = datetime.utcnow()
    items = []
    for a in approvals:
        resp = ApprovalResponse.model_validate(a)
        if a.assigned_to:
            resp.assigned_to_name = a.assigned_to.name
        remaining = (a.expires_at - now).total_seconds()
        resp.time_remaining_seconds = max(0, int(remaining))
        items.append(resp)

    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.get("/approvals/{approval_id}", response_model=ApprovalResponse)
async def get_approval(
    approval_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ApprovalResponse:
    approval = await session.get(AgentApproval, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    now = datetime.utcnow()
    resp = ApprovalResponse.model_validate(approval)
    remaining = (approval.expires_at - now).total_seconds()
    resp.time_remaining_seconds = max(0, int(remaining))
    if approval.assigned_to:
        resp.assigned_to_name = approval.assigned_to.name
    return resp


@router.post("/approvals/{approval_id}/decide", response_model=ApprovalResponse)
async def decide_approval(
    approval_id: UUID,
    data: ApprovalDecision,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ApprovalResponse:
    """Approve, reject, or edit & approve a pending approval."""
    approval = await session.get(AgentApproval, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    if approval.status != ApprovalStatus.pending:
        raise HTTPException(status_code=400, detail="Approval already decided")

    now = datetime.utcnow()
    if now > approval.expires_at:
        raise HTTPException(status_code=400, detail="Approval has expired")

    before_state = {"status": approval.status.value}

    if data.action == "approve":
        approval.status = ApprovalStatus.approved
    elif data.action == "reject":
        approval.status = ApprovalStatus.rejected
    elif data.action == "edit_and_approve":
        approval.status = ApprovalStatus.edited_and_approved
        approval.edited_content = data.edited_content

    approval.decided_at = now
    approval.decided_by_user_id = user.user_id

    await write_audit_log(
        session,
        team_id=user.team_id,
        action=f"approval.{data.action}",
        entity_type="agent_approval",
        entity_id=approval_id,
        before_state=before_state,
        after_state={"status": approval.status.value, "action": data.action},
    )

    # If approved, mark run for resumption
    if data.action in ("approve", "edit_and_approve"):
        # TODO: Resume LangGraph graph via graph.update_state() + stream()
        pass

    # If rejected, update run status
    if data.action == "reject":
        run = await session.get(AgentRun, approval.run_id)
        if run:
            run.status = AgentRunStatus.failed
            run.completed_at = now

    await session.flush()
    await session.refresh(approval)

    resp = ApprovalResponse.model_validate(approval)
    remaining = (approval.expires_at - now).total_seconds()
    resp.time_remaining_seconds = max(0, int(remaining))
    return resp


# ── Audit Log ───────────────────────────────────────────────
@router.get("/audit", response_model=PaginatedResponse[AuditLogResponse])
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[AuditLogResponse]:
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
        count_query = count_query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
        count_query = count_query.where(AuditLog.entity_id == entity_id)

    total = (await session.execute(count_query)).scalar() or 0
    offset = (page - 1) * page_size
    result = await session.execute(
        query.offset(offset).limit(page_size).order_by(AuditLog.timestamp.desc())
    )
    logs = result.scalars().all()
    return PaginatedResponse.create(
        items=[AuditLogResponse.model_validate(l) for l in logs],
        total=total, page=page, page_size=page_size,
    )
