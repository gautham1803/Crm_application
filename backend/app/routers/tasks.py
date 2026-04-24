"""Tasks router."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.models.task import Task, TaskStatus
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/tasks")


@router.get("", response_model=PaginatedResponse[TaskResponse])
async def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    assigned_to: UUID | None = None,
    task_status: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[TaskResponse]:
    query = select(Task).where(Task.deleted_at.is_(None))
    count_query = select(func.count(Task.id)).where(Task.deleted_at.is_(None))

    if assigned_to:
        query = query.where(Task.assigned_to_user_id == assigned_to)
        count_query = count_query.where(Task.assigned_to_user_id == assigned_to)
    if task_status:
        query = query.where(Task.status == TaskStatus(task_status))
        count_query = count_query.where(Task.status == TaskStatus(task_status))

    total = (await session.execute(count_query)).scalar() or 0
    offset = (page - 1) * page_size
    result = await session.execute(
        query.offset(offset).limit(page_size).order_by(Task.due_at.asc().nullslast())
    )
    tasks = result.scalars().all()

    items = []
    for t in tasks:
        resp = TaskResponse.model_validate(t)
        if t.assigned_to:
            resp.assigned_to_name = t.assigned_to.name
        items.append(resp)

    return PaginatedResponse.create(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> TaskResponse:
    task = Task(team_id=user.team_id, **data.model_dump())
    session.add(task)
    await session.flush()
    await session.refresh(task)
    return TaskResponse.model_validate(task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    data: TaskUpdate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> TaskResponse:
    task = await session.get(Task, task_id)
    if not task or task.deleted_at:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = TaskStatus(update_data["status"])
    for key, value in update_data.items():
        setattr(task, key, value)

    await session.flush()
    await session.refresh(task)
    return TaskResponse.model_validate(task)
