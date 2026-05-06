from __future__ import annotations

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import engine
import models_pg
from tools.base import BaseTool, ToolResult
from tools.context import AgentExecutionContext


class CustomerLookupByIdentity(BaseTool):
    name = "customer.lookup_by_identity"
    description = "Resolve a customer record from a channel-specific external identifier."
    scopes = ["customers:read"]

    async def execute(
        self,
        ctx: AgentExecutionContext,
        *,
        channel: str,
        external_id: str,
        tenant_id: str,
    ) -> ToolResult:
        async with AsyncSession(engine) as db:
            result = await db.execute(
                select(models_pg.MktCustomerIdentity, models_pg.Customer)
                .join(
                    models_pg.Customer,
                    models_pg.Customer.id == models_pg.MktCustomerIdentity.customer_id,
                )
                .where(
                    models_pg.MktCustomerIdentity.channel == channel,
                    models_pg.MktCustomerIdentity.external_id == external_id,
                    models_pg.MktCustomerIdentity.company_id == tenant_id,
                )
                .limit(1)
            )
            row = result.one_or_none()

        if row is None:
            return ToolResult(success=True, data={"customer": None})

        _, customer = row
        return ToolResult(
            success=True,
            data={
                "customer": {
                    "customer_id": customer.id,
                    "name": customer.name,
                    "email": customer.email,
                    "phone": customer.phone,
                }
            },
        )


class CustomerGetProfile(BaseTool):
    name = "customer.get_profile"
    description = "Fetch full profile for a customer including booking statistics."
    scopes = ["customers:read"]

    async def execute(
        self,
        ctx: AgentExecutionContext,
        *,
        customer_id: str,
    ) -> ToolResult:
        async with AsyncSession(engine) as db:
            customer_result = await db.execute(
                select(models_pg.Customer).where(
                    models_pg.Customer.id == customer_id
                )
            )
            customer = customer_result.scalar_one_or_none()

            if customer is None:
                return ToolResult(success=False, data=None, error="customer_not_found")

            stats_result = await db.execute(
                select(
                    func.count(models_pg.Booking.id).label("total_bookings"),
                    func.max(models_pg.Booking.created_at).label("last_visit"),
                ).where(models_pg.Booking.customer_id == customer_id)
            )
            stats = stats_result.one()

        return ToolResult(
            success=True,
            data={
                "id": customer.id,
                "name": customer.name,
                "email": customer.email,
                "phone": customer.phone,
                "created_at": customer.created_at.isoformat() if customer.created_at else None,
                "total_bookings": stats.total_bookings or 0,
                "last_visit": stats.last_visit.isoformat() if stats.last_visit else None,
            },
        )


class CustomerGetOrderHistory(BaseTool):
    name = "customer.get_order_history"
    description = "Return recent bookings for a customer, newest first."
    scopes = ["customers:read"]

    async def execute(
        self,
        ctx: AgentExecutionContext,
        *,
        customer_id: str,
        limit: int = 5,
    ) -> ToolResult:
        async with AsyncSession(engine) as db:
            result = await db.execute(
                select(models_pg.Booking)
                .where(models_pg.Booking.customer_id == customer_id)
                .order_by(models_pg.Booking.created_at.desc())
                .limit(limit)
            )
            bookings = result.scalars().all()

        rows = [
            {
                "id": b.id,
                "status": b.status,
                "created_at": b.created_at.isoformat() if b.created_at else None,
                "services": [],  # service join deferred; populated by caller if needed
            }
            for b in bookings
        ]
        return ToolResult(success=True, data={"bookings": rows})
