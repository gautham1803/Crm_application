"""Import/Export router — CSV upload/download for contacts."""

from __future__ import annotations

import csv
import io
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db_session
from app.models.contact import Contact

router = APIRouter()


@router.post("/import/contacts")
async def import_contacts(
    file: UploadFile = File(...),
    dry_run: bool = Query(False, description="Validate only, no writes"),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Import contacts from CSV. Supports dry-run mode."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be CSV")

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    results = {"total": 0, "created": 0, "errors": []}
    rows_to_create: list[Contact] = []

    for i, row in enumerate(reader, start=2):  # 1-indexed, header is row 1
        results["total"] += 1
        errors: list[str] = []

        first_name = row.get("first_name", "").strip()
        last_name = row.get("last_name", "").strip()
        email = row.get("email", "").strip()

        if not first_name:
            errors.append("Missing first_name")
        if not last_name:
            errors.append("Missing last_name")
        if not email:
            errors.append("Missing email")

        if errors:
            results["errors"].append({"row": i, "errors": errors})
            continue

        contact = Contact(
            team_id=user.team_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=row.get("phone", "").strip() or None,
            consent_email=row.get("consent_email", "").strip().lower() in ("true", "1", "yes"),
            consent_sms=row.get("consent_sms", "").strip().lower() in ("true", "1", "yes"),
        )
        rows_to_create.append(contact)

    if not dry_run and rows_to_create:
        session.add_all(rows_to_create)
        await session.flush()
        results["created"] = len(rows_to_create)

    if dry_run:
        results["created"] = 0
        results["would_create"] = len(rows_to_create)

    return results


@router.get("/export/contacts")
async def export_contacts(
    search: str | None = None,
    account_id: UUID | None = None,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> StreamingResponse:
    """Export contacts as CSV, respecting filters + RLS."""
    query = select(Contact).where(Contact.deleted_at.is_(None))
    if search:
        from sqlalchemy import or_
        query = query.where(or_(
            Contact.first_name.ilike(f"%{search}%"),
            Contact.last_name.ilike(f"%{search}%"),
            Contact.email.ilike(f"%{search}%"),
        ))
    if account_id:
        query = query.where(Contact.account_id == account_id)

    result = await session.execute(query.order_by(Contact.created_at.desc()))
    contacts = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "first_name", "last_name", "email", "phone",
        "account_id", "consent_sms", "consent_email", "created_at",
    ])

    for c in contacts:
        writer.writerow([
            str(c.id), c.first_name, c.last_name, c.email, c.phone or "",
            str(c.account_id) if c.account_id else "",
            str(c.consent_sms), str(c.consent_email),
            c.created_at.isoformat(),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts_export.csv"},
    )
