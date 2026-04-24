"""Products CRUD router."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/products")


@router.get("", response_model=PaginatedResponse[ProductResponse])
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[ProductResponse]:
    query = select(Product).where(Product.deleted_at.is_(None))
    count_query = select(func.count(Product.id)).where(Product.deleted_at.is_(None))

    if search:
        search_filter = Product.name.ilike(f"%{search}%") | Product.sku.ilike(f"%{search}%")
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    total = (await session.execute(count_query)).scalar() or 0
    offset = (page - 1) * page_size
    result = await session.execute(
        query.offset(offset).limit(page_size).order_by(Product.name)
    )
    products = result.scalars().all()

    return PaginatedResponse.create(
        items=[ProductResponse.model_validate(p) for p in products],
        total=total, page=page, page_size=page_size,
    )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ProductResponse:
    product = await session.get(Product, product_id)
    if not product or product.deleted_at:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductResponse.model_validate(product)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ProductResponse:
    product = Product(team_id=user.team_id, **data.model_dump())
    session.add(product)
    await session.flush()
    await session.refresh(product)
    return ProductResponse.model_validate(product)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    data: ProductUpdate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ProductResponse:
    product = await session.get(Product, product_id)
    if not product or product.deleted_at:
        raise HTTPException(status_code=404, detail="Product not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    await session.flush()
    await session.refresh(product)
    return ProductResponse.model_validate(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    product = await session.get(Product, product_id)
    if not product or product.deleted_at:
        raise HTTPException(status_code=404, detail="Product not found")
    product.deleted_at = datetime.utcnow()
    await session.flush()
