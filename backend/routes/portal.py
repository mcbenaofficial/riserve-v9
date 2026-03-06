"""
Staff Self-Service Portal API
Provides personal workspace endpoints for staff members:
- Attendance (clock in/out, history)
- Leave requests (submit, cancel, view)
- Payslips (view monthly payslips)
- Schedule (my assigned bookings)
- Stats summary
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

import models_pg
from .dependencies import get_current_user, User, get_db

router = APIRouter(prefix="/portal", tags=["Staff Portal"])


# ─────────────────────────── Pydantic Models ────────────────────────────

class ClockInRequest(BaseModel):
    notes: Optional[str] = None

class ClockOutRequest(BaseModel):
    notes: Optional[str] = None

class LeaveRequestCreate(BaseModel):
    leave_type: str          # sick, annual, emergency, maternity, unpaid
    start_date: date
    end_date: date
    reason: Optional[str] = None

class LeaveRequestUpdate(BaseModel):
    status: str              # approved, rejected (manager only)
    manager_notes: Optional[str] = None


# ─────────────────────────── Helper ─────────────────────────────────────

async def get_my_staff(user: User, db: AsyncSession) -> models_pg.Staff:
    """Get the staff record linked to the current logged-in user."""
    res = await db.execute(
        select(models_pg.Staff).where(models_pg.Staff.user_id == user.id)
    )
    staff = res.scalar_one_or_none()
    if not staff:
        raise HTTPException(
            status_code=404,
            detail="No staff profile linked to your account. Please contact your administrator."
        )
    return staff


# ─────────────────────────── Profile ────────────────────────────────────

@router.get("/me")
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's staff profile."""
    staff = await get_my_staff(current_user, db)
    return {
        "id": staff.id,
        "user_id": staff.user_id,
        "first_name": staff.first_name,
        "last_name": staff.last_name,
        "full_name": f"{staff.first_name or ''} {staff.last_name or ''}".strip(),
        "email": staff.email,
        "phone": staff.phone,
        "department": staff.department,
        "employment_type": staff.employment_type,
        "status": staff.status,
        "outlet_id": staff.outlet_id,
    }


# ─────────────────────────── Stats Dashboard ────────────────────────────

@router.get("/stats")
async def get_my_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Summary stats: today's hours, weekly hours, leave balance."""
    staff = await get_my_staff(current_user, db)

    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    start_of_month = today.replace(day=1)

    # Today's attendance
    today_att = await db.execute(
        select(models_pg.Attendance).where(
            and_(
                models_pg.Attendance.staff_id == staff.id,
                models_pg.Attendance.date == today
            )
        )
    )
    today_rec = today_att.scalar_one_or_none()

    # Weekly hours
    week_res = await db.execute(
        select(func.sum(models_pg.Attendance.hours_worked)).where(
            and_(
                models_pg.Attendance.staff_id == staff.id,
                models_pg.Attendance.date >= start_of_week,
                models_pg.Attendance.date <= today
            )
        )
    )
    weekly_hours = float(week_res.scalar_one() or 0)

    # Monthly hours
    month_res = await db.execute(
        select(func.sum(models_pg.Attendance.hours_worked)).where(
            and_(
                models_pg.Attendance.staff_id == staff.id,
                models_pg.Attendance.date >= start_of_month,
                models_pg.Attendance.date <= today
            )
        )
    )
    monthly_hours = float(month_res.scalar_one() or 0)

    # Leave balance (annual: 21 days, minus approved leaves taken this year)
    approved_leaves = await db.execute(
        select(func.sum(models_pg.LeaveRequest.days_requested)).where(
            and_(
                models_pg.LeaveRequest.staff_id == staff.id,
                models_pg.LeaveRequest.status == "approved",
                models_pg.LeaveRequest.leave_type == "annual",
                func.extract("year", models_pg.LeaveRequest.start_date) == today.year
            )
        )
    )
    used_annual = int(approved_leaves.scalar_one() or 0)
    annual_balance = max(0, 21 - used_annual)

    # Pending leaves count
    pending_res = await db.execute(
        select(func.count()).where(
            and_(
                models_pg.LeaveRequest.staff_id == staff.id,
                models_pg.LeaveRequest.status == "pending"
            )
        )
    )
    pending_leaves = pending_res.scalar_one()

    # Current clock status
    is_clocked_in = (
        today_rec is not None and
        today_rec.clock_in is not None and
        today_rec.clock_out is None
    )
    hours_today = float(today_rec.hours_worked or 0) if today_rec else 0
    if is_clocked_in and today_rec.clock_in:
        elapsed = (datetime.now(timezone.utc) - today_rec.clock_in).total_seconds() / 3600
        hours_today = round(elapsed, 2)

    return {
        "is_clocked_in": is_clocked_in,
        "clock_in_time": today_rec.clock_in.isoformat() if (today_rec and today_rec.clock_in) else None,
        "clock_out_time": today_rec.clock_out.isoformat() if (today_rec and today_rec.clock_out) else None,
        "hours_today": hours_today,
        "weekly_hours": round(weekly_hours, 2),
        "monthly_hours": round(monthly_hours, 2),
        "annual_leave_balance": annual_balance,
        "annual_leave_used": used_annual,
        "pending_leaves": pending_leaves,
    }


# ─────────────────────────── Attendance ─────────────────────────────────

@router.post("/attendance/clock-in")
async def clock_in(
    body: ClockInRequest = ClockInRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    staff = await get_my_staff(current_user, db)
    today = date.today()
    now = datetime.now(timezone.utc)

    # Check if already clocked in today
    existing_res = await db.execute(
        select(models_pg.Attendance).where(
            and_(
                models_pg.Attendance.staff_id == staff.id,
                models_pg.Attendance.date == today
            )
        )
    )
    existing = existing_res.scalar_one_or_none()

    if existing:
        if existing.clock_in and not existing.clock_out:
            raise HTTPException(status_code=400, detail="Already clocked in today. Please clock out first.")
        if existing.clock_out:
            raise HTTPException(status_code=400, detail="You have already completed your shift today.")
        existing.clock_in = now
        existing.status = "present"
        existing.notes = body.notes
    else:
        record = models_pg.Attendance(
            staff_id=staff.id,
            company_id=staff.company_id,
            date=today,
            clock_in=now,
            status="present",
            notes=body.notes
        )
        db.add(record)

    await db.commit()
    return {"message": "Clocked in successfully", "clock_in": now.isoformat()}


@router.post("/attendance/clock-out")
async def clock_out(
    body: ClockOutRequest = ClockOutRequest(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    staff = await get_my_staff(current_user, db)
    today = date.today()
    now = datetime.now(timezone.utc)

    res = await db.execute(
        select(models_pg.Attendance).where(
            and_(
                models_pg.Attendance.staff_id == staff.id,
                models_pg.Attendance.date == today
            )
        )
    )
    record = res.scalar_one_or_none()

    if not record or not record.clock_in:
        raise HTTPException(status_code=400, detail="You haven't clocked in today.")
    if record.clock_out:
        raise HTTPException(status_code=400, detail="Already clocked out today.")

    record.clock_out = now
    elapsed_hours = (now - record.clock_in).total_seconds() / 3600
    record.hours_worked = round(elapsed_hours, 2)
    if body.notes:
        record.notes = body.notes

    await db.commit()
    return {
        "message": "Clocked out successfully",
        "clock_out": now.isoformat(),
        "hours_worked": float(record.hours_worked)
    }


@router.get("/attendance/today")
async def get_today_attendance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    staff = await get_my_staff(current_user, db)
    today = date.today()

    res = await db.execute(
        select(models_pg.Attendance).where(
            and_(
                models_pg.Attendance.staff_id == staff.id,
                models_pg.Attendance.date == today
            )
        )
    )
    rec = res.scalar_one_or_none()
    if not rec:
        return {"date": str(today), "status": "not_clocked_in", "clock_in": None, "clock_out": None, "hours_worked": 0}

    return {
        "id": rec.id,
        "date": str(rec.date),
        "status": rec.status,
        "clock_in": rec.clock_in.isoformat() if rec.clock_in else None,
        "clock_out": rec.clock_out.isoformat() if rec.clock_out else None,
        "hours_worked": float(rec.hours_worked or 0),
        "notes": rec.notes,
    }


@router.get("/attendance/history")
async def get_attendance_history(
    days: int = Query(30, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    staff = await get_my_staff(current_user, db)
    since = date.today() - timedelta(days=days)

    res = await db.execute(
        select(models_pg.Attendance).where(
            and_(
                models_pg.Attendance.staff_id == staff.id,
                models_pg.Attendance.date >= since
            )
        ).order_by(models_pg.Attendance.date.desc())
    )
    records = res.scalars().all()

    return [
        {
            "id": r.id,
            "date": str(r.date),
            "status": r.status,
            "clock_in": r.clock_in.isoformat() if r.clock_in else None,
            "clock_out": r.clock_out.isoformat() if r.clock_out else None,
            "hours_worked": float(r.hours_worked or 0),
            "notes": r.notes,
        }
        for r in records
    ]


# ─────────────────────────── Leave Requests ─────────────────────────────

@router.get("/leaves")
async def get_my_leaves(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    staff = await get_my_staff(current_user, db)

    stmt = select(models_pg.LeaveRequest).where(
        models_pg.LeaveRequest.staff_id == staff.id
    ).order_by(models_pg.LeaveRequest.created_at.desc())

    if status:
        stmt = stmt.where(models_pg.LeaveRequest.status == status)

    res = await db.execute(stmt)
    leaves = res.scalars().all()

    return [
        {
            "id": l.id,
            "leave_type": l.leave_type,
            "start_date": str(l.start_date),
            "end_date": str(l.end_date),
            "days_requested": l.days_requested,
            "reason": l.reason,
            "status": l.status,
            "manager_notes": l.manager_notes,
            "created_at": l.created_at.isoformat(),
            "reviewed_at": l.reviewed_at.isoformat() if l.reviewed_at else None,
        }
        for l in leaves
    ]


@router.post("/leaves")
async def submit_leave_request(
    body: LeaveRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    staff = await get_my_staff(current_user, db)

    if body.end_date < body.start_date:
        raise HTTPException(status_code=400, detail="End date cannot be before start date.")

    days = (body.end_date - body.start_date).days + 1

    leave = models_pg.LeaveRequest(
        staff_id=staff.id,
        company_id=staff.company_id,
        leave_type=body.leave_type,
        start_date=body.start_date,
        end_date=body.end_date,
        days_requested=days,
        reason=body.reason,
        status="pending"
    )
    db.add(leave)
    await db.commit()
    await db.refresh(leave)

    return {
        "id": leave.id,
        "leave_type": leave.leave_type,
        "start_date": str(leave.start_date),
        "end_date": str(leave.end_date),
        "days_requested": leave.days_requested,
        "status": leave.status,
        "message": "Leave request submitted successfully."
    }


@router.put("/leaves/{leave_id}/cancel")
async def cancel_leave_request(
    leave_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    staff = await get_my_staff(current_user, db)

    res = await db.execute(
        select(models_pg.LeaveRequest).where(
            and_(
                models_pg.LeaveRequest.id == leave_id,
                models_pg.LeaveRequest.staff_id == staff.id
            )
        )
    )
    leave = res.scalar_one_or_none()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found.")
    if leave.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot cancel a {leave.status} leave request.")

    leave.status = "cancelled"
    await db.commit()
    return {"message": "Leave request cancelled."}


# Manager: review a leave request
@router.put("/leaves/{leave_id}/review")
async def review_leave_request(
    leave_id: str,
    body: LeaveRequestUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role not in ["Manager", "Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Only managers can review leave requests.")

    if body.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'.")

    res = await db.execute(
        select(models_pg.LeaveRequest).where(
            and_(
                models_pg.LeaveRequest.id == leave_id,
                models_pg.LeaveRequest.company_id == current_user.company_id
            )
        )
    )
    leave = res.scalar_one_or_none()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    leave.status = body.status
    leave.manager_notes = body.manager_notes
    leave.reviewed_by = current_user.id
    leave.reviewed_at = datetime.now(timezone.utc)
    await db.commit()

    return {"message": f"Leave request {body.status}.", "leave_id": leave_id}


# ─────────────────────────── Payslips ───────────────────────────────────

@router.get("/payslips")
async def get_my_payslips(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    staff = await get_my_staff(current_user, db)

    res = await db.execute(
        select(models_pg.Payslip).where(
            and_(
                models_pg.Payslip.staff_id == staff.id,
                models_pg.Payslip.status == "published"
            )
        ).order_by(models_pg.Payslip.year.desc(), models_pg.Payslip.month.desc())
    )
    payslips = res.scalars().all()

    return [
        {
            "id": p.id,
            "month": p.month,
            "year": p.year,
            "pay_period_label": p.pay_period_label,
            "gross_pay": float(p.gross_pay),
            "net_pay": float(p.net_pay),
            "total_deductions": float(p.total_deductions),
            "days_present": p.days_present,
            "status": p.status,
        }
        for p in payslips
    ]


@router.get("/payslips/{payslip_id}")
async def get_payslip_detail(
    payslip_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    staff = await get_my_staff(current_user, db)

    res = await db.execute(
        select(models_pg.Payslip).where(
            and_(
                models_pg.Payslip.id == payslip_id,
                models_pg.Payslip.staff_id == staff.id
            )
        )
    )
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Payslip not found.")

    return {
        "id": p.id,
        "month": p.month,
        "year": p.year,
        "pay_period_label": p.pay_period_label,
        "earnings": {
            "basic_salary": float(p.basic_salary),
            "allowances": float(p.allowances),
            "overtime_pay": float(p.overtime_pay),
            "commission": float(p.commission),
            "bonus": float(p.bonus),
            "gross_pay": float(p.gross_pay),
        },
        "deductions": {
            "tax": float(p.tax),
            "provident_fund": float(p.provident_fund),
            "other": float(p.other_deductions),
            "total": float(p.total_deductions),
        },
        "net_pay": float(p.net_pay),
        "attendance": {
            "hours_worked": float(p.hours_worked),
            "days_present": p.days_present,
            "days_absent": p.days_absent,
            "leaves_taken": p.leaves_taken,
        },
        "notes": p.notes,
    }


# ─────────────────────────── Schedule ───────────────────────────────────

@router.get("/schedule")
async def get_my_schedule(
    days: int = Query(14, ge=1, le=60),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns the logged-in user's upcoming bookings (matched by resource.user_id)."""
    today = date.today()
    end_date = today + timedelta(days=days)

    # Find the resource linked to this user
    resource_res = await db.execute(
        select(models_pg.Resource).where(
            models_pg.Resource.user_id == current_user.id
        )
    )
    resources = resource_res.scalars().all()
    resource_ids = [r.id for r in resources]

    if not resource_ids:
        return []

    booking_res = await db.execute(
        select(models_pg.Booking).where(
            and_(
                models_pg.Booking.resource_id.in_(resource_ids),
                models_pg.Booking.date >= str(today),
                models_pg.Booking.date <= str(end_date),
                models_pg.Booking.status.notin_(["cancelled", "no_show"])
            )
        ).order_by(models_pg.Booking.date, models_pg.Booking.time)
    )
    bookings = booking_res.scalars().all()

    return [
        {
            "id": b.id,
            "date": b.date,
            "time": b.time,
            "service_name": b.service_name,
            "customer_name": b.customer_name,
            "customer_phone": b.customer_phone,
            "duration": b.duration,
            "status": b.status,
            "outlet_id": b.outlet_id,
        }
        for b in bookings
    ]
