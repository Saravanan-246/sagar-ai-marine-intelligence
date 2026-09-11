"""
Audit History Router.
Read-only. Returns the immutable state-transition log for decisions.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AuditEntry
from app.schemas import AuditEntryOut

router = APIRouter()


@router.get("/{decision_id}", response_model=List[AuditEntryOut])
async def get_audit_history(
    decision_id: str,
    limit: Optional[int] = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the full audit trail for a decision, newest first.
    This log is append-only and immutable once written.
    """
    result = await db.execute(
        select(AuditEntry)
        .where(AuditEntry.decision_id == decision_id)
        .order_by(AuditEntry.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/", response_model=List[AuditEntryOut])
async def get_all_audit_entries(
    limit: Optional[int] = Query(default=200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """Returns recent audit entries across all decisions, newest first."""
    result = await db.execute(
        select(AuditEntry)
        .order_by(AuditEntry.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
