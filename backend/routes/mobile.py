"""Mobile staff app routes — tasks, messages, incidents, shift notes, attendance summary."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

import models_pg
from .dependencies import get_current_user, User, get_db

router = APIRouter(prefix="/mobile", tags=["Mobile Staff"])


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str = "general"
    priority: str = "normal"
    outlet_id: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None

class TaskUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None

class MessageCreate(BaseModel):
    content: str
    channel: str = "general"
    outlet_id: Optional[str] = None

class IncidentCreate(BaseModel):
    incident_type: str
    severity: str = "medium"
    description: str
    table_ref: Optional[str] = None
    customer_ref: Optional[str] = None
    outlet_id: Optional[str] = None

class IncidentUpdate(BaseModel):
    status: Optional[str] = None
    manager_notes: Optional[str] = None

class ShiftNoteCreate(BaseModel):
    content: str
    tags: List[str] = []
    shift_date: date
    shift_type: str = "day"
    outlet_id: Optional[str] = None


# ── Tasks ────────────────────────────────────────────────────────────────────

@router.get("/tasks")
async def list_tasks(
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(models_pg.StaffTask).where(
        models_pg.StaffTask.company_id == current_user.company_id
    )
    if outlet_id:
        q = q.where(models_pg.StaffTask.outlet_id == outlet_id)
    if status:
        q = q.where(models_pg.StaffTask.status == status)
    q = q.order_by(models_pg.StaffTask.created_at.desc())
    result = await db.execute(q)
    tasks = result.scalars().all()
    return [
        {
            "id": t.id, "title": t.title, "description": t.description,
            "category": t.category, "priority": t.priority, "status": t.status,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "assigned_to": t.assigned_to, "completed_at": t.completed_at,
            "created_at": t.created_at,
        }
        for t in tasks
    ]


@router.post("/tasks")
async def create_task(
    body: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import uuid
    task = models_pg.StaffTask(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        outlet_id=body.outlet_id,
        assigned_to=body.assigned_to,
        created_by=current_user.id,
        title=body.title,
        description=body.description,
        category=body.category,
        priority=body.priority,
        due_date=body.due_date,
    )
    db.add(task)
    await db.commit()
    return {"id": task.id, "message": "Task created"}


@router.put("/tasks/{task_id}")
async def update_task(
    task_id: str,
    body: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(models_pg.StaffTask).where(
            models_pg.StaffTask.id == task_id,
            models_pg.StaffTask.company_id == current_user.company_id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    if body.status:
        task.status = body.status
        if body.status == "done":
            task.completed_at = datetime.now(timezone.utc)
    if body.title:
        task.title = body.title
    if body.description is not None:
        task.description = body.description
    if body.priority:
        task.priority = body.priority
    await db.commit()
    return {"message": "Task updated"}


# ── Messages ─────────────────────────────────────────────────────────────────

@router.get("/messages")
async def list_messages(
    channel: str = "general",
    outlet_id: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(models_pg.StaffMessage).where(
        models_pg.StaffMessage.company_id == current_user.company_id,
        models_pg.StaffMessage.channel == channel,
    )
    if outlet_id:
        q = q.where(models_pg.StaffMessage.outlet_id == outlet_id)
    q = q.order_by(models_pg.StaffMessage.created_at.desc()).limit(limit)
    result = await db.execute(q)
    msgs = result.scalars().all()
    return [
        {
            "id": m.id, "sender_name": m.sender_name, "channel": m.channel,
            "content": m.content, "message_type": m.message_type,
            "created_at": m.created_at,
        }
        for m in reversed(msgs)
    ]


@router.post("/messages")
async def send_message(
    body: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import uuid
    msg = models_pg.StaffMessage(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        outlet_id=body.outlet_id,
        sender_id=None,
        sender_name=current_user.name or current_user.email,
        channel=body.channel,
        content=body.content,
    )
    db.add(msg)
    await db.commit()
    return {"id": msg.id, "message": "Message sent"}


# ── Incidents ────────────────────────────────────────────────────────────────

@router.get("/incidents")
async def list_incidents(
    status: Optional[str] = None,
    outlet_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(models_pg.StaffIncident).where(
        models_pg.StaffIncident.company_id == current_user.company_id
    )
    if status:
        q = q.where(models_pg.StaffIncident.status == status)
    if outlet_id:
        q = q.where(models_pg.StaffIncident.outlet_id == outlet_id)
    q = q.order_by(models_pg.StaffIncident.created_at.desc())
    result = await db.execute(q)
    incidents = result.scalars().all()
    return [
        {
            "id": i.id, "incident_type": i.incident_type, "severity": i.severity,
            "description": i.description, "table_ref": i.table_ref,
            "customer_ref": i.customer_ref, "status": i.status,
            "reporter_name": i.reporter_name, "manager_notes": i.manager_notes,
            "created_at": i.created_at,
        }
        for i in incidents
    ]


@router.post("/incidents")
async def report_incident(
    body: IncidentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import uuid
    incident = models_pg.StaffIncident(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        outlet_id=body.outlet_id,
        reporter_name=current_user.name or current_user.email,
        incident_type=body.incident_type,
        severity=body.severity,
        description=body.description,
        table_ref=body.table_ref,
        customer_ref=body.customer_ref,
    )
    db.add(incident)
    await db.commit()
    return {"id": incident.id, "message": "Incident reported"}


@router.put("/incidents/{incident_id}")
async def update_incident(
    incident_id: str,
    body: IncidentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(models_pg.StaffIncident).where(
            models_pg.StaffIncident.id == incident_id,
            models_pg.StaffIncident.company_id == current_user.company_id,
        )
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(404, "Incident not found")
    if body.status:
        incident.status = body.status
        if body.status == "resolved":
            incident.resolved_at = datetime.now(timezone.utc)
    if body.manager_notes is not None:
        incident.manager_notes = body.manager_notes
    await db.commit()
    return {"message": "Incident updated"}


# ── Shift Notes ───────────────────────────────────────────────────────────────

@router.get("/shift-notes")
async def list_shift_notes(
    shift_date: Optional[date] = None,
    outlet_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(models_pg.ShiftNote).where(
        models_pg.ShiftNote.company_id == current_user.company_id
    )
    if shift_date:
        q = q.where(models_pg.ShiftNote.shift_date == shift_date)
    if outlet_id:
        q = q.where(models_pg.ShiftNote.outlet_id == outlet_id)
    q = q.order_by(models_pg.ShiftNote.created_at.desc()).limit(20)
    result = await db.execute(q)
    notes = result.scalars().all()
    return [
        {
            "id": n.id, "author_name": n.author_name, "content": n.content,
            "tags": n.tags, "shift_date": n.shift_date.isoformat(),
            "shift_type": n.shift_type, "created_at": n.created_at,
        }
        for n in notes
    ]


@router.post("/shift-notes")
async def create_shift_note(
    body: ShiftNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import uuid
    note = models_pg.ShiftNote(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        outlet_id=body.outlet_id,
        author_name=current_user.name or current_user.email,
        content=body.content,
        tags=body.tags,
        shift_date=body.shift_date,
        shift_type=body.shift_type,
    )
    db.add(note)
    await db.commit()
    return {"id": note.id, "message": "Shift note saved"}


# ── Attendance summary (mobile-friendly) ─────────────────────────────────────

@router.get("/me/attendance-today")
async def my_attendance_today(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    # Find staff record linked to this user
    result = await db.execute(
        select(models_pg.Staff).where(
            models_pg.Staff.user_id == current_user.id,
            models_pg.Staff.company_id == current_user.company_id,
        )
    )
    staff = result.scalar_one_or_none()
    if not staff:
        return {"clocked_in": False, "clock_in": None, "clock_out": None, "hours_worked": 0}

    att_result = await db.execute(
        select(models_pg.Attendance).where(
            models_pg.Attendance.staff_id == staff.id,
            models_pg.Attendance.date == today,
        )
    )
    att = att_result.scalar_one_or_none()
    if not att:
        return {"clocked_in": False, "clock_in": None, "clock_out": None, "hours_worked": 0, "staff_id": staff.id}
    return {
        "clocked_in": att.clock_in is not None and att.clock_out is None,
        "clock_in": att.clock_in,
        "clock_out": att.clock_out,
        "hours_worked": float(att.hours_worked or 0),
        "staff_id": staff.id,
        "attendance_id": att.id,
    }


@router.get("/me/profile")
async def my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(models_pg.Staff).where(
            models_pg.Staff.user_id == current_user.id,
            models_pg.Staff.company_id == current_user.company_id,
        )
    )
    staff = result.scalar_one_or_none()
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "staff": {
            "id": staff.id,
            "department": staff.department,
            "employment_type": staff.employment_type,
            "skills": staff.skills,
        } if staff else None,
    }


# ── Salon endpoints ───────────────────────────────────────────────────────────

@router.get("/salon/appointments")
async def salon_appointments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    stmt = (
        select(models_pg.Booking)
        .where(
            models_pg.Booking.company_id == current_user.company_id,
            models_pg.Booking.date == today,
        )
        .order_by(models_pg.Booking.time)
    )
    if current_user.outlets:
        stmt = stmt.where(models_pg.Booking.outlet_id.in_(current_user.outlets))

    res = await db.execute(stmt)
    bookings = res.scalars().all()

    resource_cache: dict = {}

    async def get_resource_name(rid: str) -> Optional[str]:
        if not rid:
            return None
        if rid not in resource_cache:
            r = await db.execute(select(models_pg.Resource).where(models_pg.Resource.id == rid))
            obj = r.scalar_one_or_none()
            resource_cache[rid] = obj.name if obj else None
        return resource_cache[rid]

    result = []
    for b in bookings:
        resource_name = await get_resource_name(b.resource_id) if b.resource_id else None
        result.append({
            "id": b.id,
            "client_name": b.customer_name or b.customer,
            "client_phone": b.customer_phone,
            "time": b.time,
            "duration": b.duration,
            "status": b.status,
            "resource_name": resource_name,
            "notes": b.notes,
            "amount": float(b.amount or 0),
        })

    return result


@router.get("/salon/rooms")
async def salon_rooms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    outlet_ids = current_user.outlets or []
    if not outlet_ids:
        return []

    r_res = await db.execute(
        select(models_pg.Resource).where(models_pg.Resource.outlet_id.in_(outlet_ids))
    )
    resources = r_res.scalars().all()

    today = date.today()
    now_str = datetime.now().strftime("%H:%M")
    try:
        now_h, now_m = map(int, now_str.split(":"))
        now_min = now_h * 60 + now_m
    except Exception:
        now_min = 0

    result = []
    for resource in resources:
        b_res = await db.execute(
            select(models_pg.Booking)
            .where(
                models_pg.Booking.resource_id == resource.id,
                models_pg.Booking.date == today,
                models_pg.Booking.status.in_(["Pending", "Confirmed", "In Progress"]),
            )
            .order_by(models_pg.Booking.time)
        )
        today_bookings = b_res.scalars().all()

        status = "Available"
        current_client = None
        next_client = None
        next_time = None

        for b in today_bookings:
            try:
                bh, bm = map(int, (b.time or "00:00").split(":"))
                b_start = bh * 60 + bm
                b_end = b_start + (b.duration or 60)
                if b_start <= now_min < b_end:
                    status = "Occupied"
                    current_client = b.customer_name or b.customer
                elif b_start > now_min and status != "Occupied":
                    status = "Upcoming" if status == "Available" else status
                    next_client = b.customer_name or b.customer
                    next_time = b.time
                    break
            except Exception:
                pass

        result.append({
            "id": resource.id,
            "name": resource.name,
            "status": status,
            "current_client": current_client,
            "next_client": next_client,
            "next_time": next_time,
        })

    return result


@router.get("/salon/clients")
async def salon_clients(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(models_pg.Customer)
        .where(models_pg.Customer.company_id == current_user.company_id)
        .order_by(models_pg.Customer.last_visit.desc().nullslast())
        .limit(50)
    )
    res = await db.execute(stmt)
    customers = res.scalars().all()

    return [
        {
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "phone": c.phone,
            "notes": c.notes,
            "last_visit": c.last_visit.isoformat() if c.last_visit else None,
            "total_bookings": c.total_bookings or 0,
            "total_revenue": float(c.total_revenue or 0),
        }
        for c in customers
    ]


@router.get("/salon/upsell")
async def salon_upsell(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    now_str = datetime.now().strftime("%H:%M")
    try:
        now_h, now_m = map(int, now_str.split(":"))
        now_min = now_h * 60 + now_m
    except Exception:
        now_min = 0

    stmt = (
        select(models_pg.Booking)
        .where(
            models_pg.Booking.company_id == current_user.company_id,
            models_pg.Booking.date == today,
            models_pg.Booking.status.in_(["Pending", "Confirmed"]),
        )
        .order_by(models_pg.Booking.time)
    )
    if current_user.outlets:
        stmt = stmt.where(models_pg.Booking.outlet_id.in_(current_user.outlets))

    res = await db.execute(stmt)
    bookings = res.scalars().all()

    SUGGESTIONS = [
        "Deep conditioning treatment",
        "Scalp massage add-on",
        "Brow tint",
        "Express facial",
        "Hot stone add-on",
        "Keratin treatment",
        "Aromatherapy upgrade",
        "Nail art upgrade",
    ]

    result = []
    for i, b in enumerate(bookings):
        try:
            bh, bm = map(int, (b.time or "00:00").split(":"))
            if (bh * 60 + bm) <= now_min:
                continue
        except Exception:
            pass
        suggestions = SUGGESTIONS[(i * 2) % len(SUGGESTIONS): (i * 2) % len(SUGGESTIONS) + 2]
        result.append({
            "id": b.id,
            "client_name": b.customer_name or b.customer,
            "time": b.time,
            "duration": b.duration,
            "amount": float(b.amount or 0),
            "notes": b.notes,
            "suggestions": suggestions,
        })

    return result


# ── Me: notifications ─────────────────────────────────────────────────────────

@router.get("/me/notifications")
async def my_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import timedelta

    staff_res = await db.execute(
        select(models_pg.Staff).where(
            models_pg.Staff.user_id == current_user.id,
            models_pg.Staff.company_id == current_user.company_id,
        )
    )
    staff = staff_res.scalar_one_or_none()
    staff_id = staff.id if staff else None

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    items = []

    if staff_id:
        task_res = await db.execute(
            select(models_pg.StaffTask).where(
                models_pg.StaffTask.company_id == current_user.company_id,
                models_pg.StaffTask.assigned_to == staff_id,
                models_pg.StaffTask.created_at >= cutoff,
            ).order_by(models_pg.StaffTask.created_at.desc()).limit(10)
        )
        for t in task_res.scalars().all():
            items.append({
                "id": f"task-{t.id}",
                "type": "task",
                "title": t.title,
                "body": f"Priority: {t.priority} · Status: {t.status}",
                "icon": "ClipboardList",
                "color": "warning" if t.priority == "high" else "accent",
                "created_at": t.created_at.isoformat() if t.created_at else None,
            })

        inc_res = await db.execute(
            select(models_pg.StaffIncident).where(
                models_pg.StaffIncident.company_id == current_user.company_id,
                models_pg.StaffIncident.reported_by == staff_id,
                models_pg.StaffIncident.created_at >= cutoff,
            ).order_by(models_pg.StaffIncident.created_at.desc()).limit(5)
        )
        for inc in inc_res.scalars().all():
            color = "error" if inc.severity in ("high", "critical") else "warning"
            items.append({
                "id": f"inc-{inc.id}",
                "type": "incident",
                "title": f"Incident: {inc.incident_type.replace('_', ' ').title()}",
                "body": f"Status: {inc.status} · {inc.description[:60]}{'…' if len(inc.description) > 60 else ''}",
                "icon": "AlertTriangle",
                "color": color,
                "created_at": inc.created_at.isoformat() if inc.created_at else None,
            })

    msg_res = await db.execute(
        select(models_pg.StaffMessage).where(
            models_pg.StaffMessage.company_id == current_user.company_id,
            models_pg.StaffMessage.created_at >= cutoff,
        ).order_by(models_pg.StaffMessage.created_at.desc()).limit(20)
    )
    for m in msg_res.scalars().all():
        items.append({
            "id": f"msg-{m.id}",
            "type": "message",
            "title": f"{m.sender_name or 'Someone'} in #{m.channel}",
            "body": m.content[:80] + ("…" if len(m.content) > 80 else ""),
            "icon": "MessageSquare",
            "color": "salon",
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })

    items.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return items[:30]


# ── Me: payslips ──────────────────────────────────────────────────────────────

@router.get("/me/payslips")
async def my_payslips(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    staff_res = await db.execute(
        select(models_pg.Staff).where(
            models_pg.Staff.user_id == current_user.id,
            models_pg.Staff.company_id == current_user.company_id,
        )
    )
    staff = staff_res.scalar_one_or_none()
    if not staff:
        return []

    res = await db.execute(
        select(models_pg.Payslip).where(
            models_pg.Payslip.staff_id == staff.id,
            models_pg.Payslip.company_id == current_user.company_id,
            models_pg.Payslip.status == "published",
        ).order_by(models_pg.Payslip.year.desc(), models_pg.Payslip.month.desc()).limit(12)
    )
    payslips = res.scalars().all()
    return [
        {
            "id": p.id,
            "period": p.pay_period_label or f"{p.month}/{p.year}",
            "month": p.month,
            "year": p.year,
            "gross_pay": float(p.gross_pay or 0),
            "net_pay": float(p.net_pay or 0),
            "total_deductions": float(p.total_deductions or 0),
            "basic_salary": float(p.basic_salary or 0),
            "allowances": float(p.allowances or 0),
            "overtime_pay": float(p.overtime_pay or 0),
            "bonus": float(p.bonus or 0),
            "tax": float(p.tax or 0),
            "provident_fund": float(p.provident_fund or 0),
            "days_present": p.days_present,
            "days_absent": p.days_absent,
        }
        for p in payslips
    ]


# ── Me: leaves ────────────────────────────────────────────────────────────────

@router.get("/me/leaves")
async def my_leaves(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    staff_res = await db.execute(
        select(models_pg.Staff).where(
            models_pg.Staff.user_id == current_user.id,
            models_pg.Staff.company_id == current_user.company_id,
        )
    )
    staff = staff_res.scalar_one_or_none()
    if not staff:
        return []

    res = await db.execute(
        select(models_pg.LeaveRequest).where(
            models_pg.LeaveRequest.staff_id == staff.id,
        ).order_by(models_pg.LeaveRequest.created_at.desc()).limit(20)
    )
    return [
        {
            "id": r.id,
            "start_date": r.start_date.isoformat() if hasattr(r.start_date, "isoformat") else r.start_date,
            "end_date": r.end_date.isoformat() if hasattr(r.end_date, "isoformat") else r.end_date,
            "days": float(r.days) if r.days else 1,
            "reason": r.reason,
            "status": r.status,
            "approver_notes": r.approver_notes,
        }
        for r in res.scalars().all()
    ]


# ── Schedule (last 14 attendance days) ───────────────────────────────────────

@router.get("/me/schedule")
async def my_schedule(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    staff_res = await db.execute(
        select(models_pg.Staff).where(models_pg.Staff.user_id == current_user.id)
    )
    staff = staff_res.scalars().first()
    if not staff:
        return []

    cutoff = datetime.now(timezone.utc).date() - timedelta(days=13)
    res = await db.execute(
        select(models_pg.Attendance).where(
            models_pg.Attendance.staff_id == staff.id,
            models_pg.Attendance.date >= cutoff,
        ).order_by(models_pg.Attendance.date.desc())
    )
    rows = res.scalars().all()
    return [
        {
            "date": r.date.isoformat(),
            "clock_in": r.clock_in.isoformat() if r.clock_in else None,
            "clock_out": r.clock_out.isoformat() if r.clock_out else None,
            "hours_worked": float(r.hours_worked) if r.hours_worked else None,
            "status": r.status,
            "notes": r.notes,
        }
        for r in rows
    ]


# ── Breaks ────────────────────────────────────────────────────────────────────

@router.get("/me/breaks")
async def my_breaks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    staff_res = await db.execute(
        select(models_pg.Staff).where(models_pg.Staff.user_id == current_user.id)
    )
    staff = staff_res.scalars().first()
    if not staff:
        return []

    today = datetime.now(timezone.utc).date()
    res = await db.execute(
        select(models_pg.BreakLog).where(
            models_pg.BreakLog.staff_id == staff.id,
            models_pg.BreakLog.date == today,
        ).order_by(models_pg.BreakLog.started_at)
    )
    rows = res.scalars().all()
    return [
        {
            "id": r.id,
            "break_type": r.break_type,
            "started_at": r.started_at.isoformat(),
            "ended_at": r.ended_at.isoformat() if r.ended_at else None,
            "duration_minutes": r.duration_minutes,
        }
        for r in rows
    ]


class BreakStart(BaseModel):
    break_type: str = "short"

@router.post("/me/breaks/start")
async def start_break(
    body: BreakStart,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    staff_res = await db.execute(
        select(models_pg.Staff).where(models_pg.Staff.user_id == current_user.id)
    )
    staff = staff_res.scalars().first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff record not found")

    now = datetime.now(timezone.utc)
    log = models_pg.BreakLog(
        staff_id=staff.id,
        company_id=staff.company_id,
        date=now.date(),
        break_type=body.break_type,
        started_at=now,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return {"id": log.id, "started_at": log.started_at.isoformat()}


@router.post("/me/breaks/{break_id}/end")
async def end_break(
    break_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(
        select(models_pg.BreakLog).where(models_pg.BreakLog.id == break_id)
    )
    log = res.scalars().first()
    if not log:
        raise HTTPException(status_code=404, detail="Break not found")

    now = datetime.now(timezone.utc)
    log.ended_at = now
    log.duration_minutes = max(1, int((now - log.started_at).total_seconds() / 60))
    await db.commit()
    return {"duration_minutes": log.duration_minutes}


# ── Tips (last 7 days) ────────────────────────────────────────────────────────

@router.get("/me/tips")
async def my_tips(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    staff_res = await db.execute(
        select(models_pg.Staff).where(models_pg.Staff.user_id == current_user.id)
    )
    staff = staff_res.scalars().first()
    if not staff:
        return []

    cutoff = datetime.now(timezone.utc).date() - timedelta(days=6)
    res = await db.execute(
        select(models_pg.TipRecord).where(
            models_pg.TipRecord.staff_id == staff.id,
            models_pg.TipRecord.date >= cutoff,
        ).order_by(models_pg.TipRecord.date.desc())
    )
    rows = res.scalars().all()
    return [
        {
            "id": r.id,
            "date": r.date.isoformat(),
            "amount": float(r.amount),
            "source_notes": r.source_notes,
        }
        for r in rows
    ]


# ── Training ──────────────────────────────────────────────────────────────────

@router.get("/me/training")
async def my_training(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    staff_res = await db.execute(
        select(models_pg.Staff).where(models_pg.Staff.user_id == current_user.id)
    )
    staff = staff_res.scalars().first()
    if not staff:
        return []

    modules_res = await db.execute(
        select(models_pg.TrainingModule).where(
            models_pg.TrainingModule.company_id == staff.company_id,
            models_pg.TrainingModule.is_active == True,
        ).order_by(models_pg.TrainingModule.created_at)
    )
    modules = modules_res.scalars().all()

    completions_res = await db.execute(
        select(models_pg.TrainingCompletion).where(
            models_pg.TrainingCompletion.staff_id == staff.id
        )
    )
    completed_ids = {c.module_id for c in completions_res.scalars().all()}

    return [
        {
            "id": m.id,
            "title": m.title,
            "category": m.category,
            "duration_minutes": m.duration_minutes,
            "completed": m.id in completed_ids,
        }
        for m in modules
    ]


@router.post("/me/training/{module_id}/complete")
async def complete_training(
    module_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    staff_res = await db.execute(
        select(models_pg.Staff).where(models_pg.Staff.user_id == current_user.id)
    )
    staff = staff_res.scalars().first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff record not found")

    existing = await db.execute(
        select(models_pg.TrainingCompletion).where(
            models_pg.TrainingCompletion.staff_id == staff.id,
            models_pg.TrainingCompletion.module_id == module_id,
        )
    )
    if existing.scalars().first():
        return {"status": "already_completed"}

    completion = models_pg.TrainingCompletion(
        staff_id=staff.id,
        module_id=module_id,
        company_id=staff.company_id,
    )
    db.add(completion)
    await db.commit()
    return {"status": "completed"}


@router.delete("/me/training/{module_id}/complete")
async def uncomplete_training(
    module_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    staff_res = await db.execute(
        select(models_pg.Staff).where(models_pg.Staff.user_id == current_user.id)
    )
    staff = staff_res.scalars().first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff record not found")

    res = await db.execute(
        select(models_pg.TrainingCompletion).where(
            models_pg.TrainingCompletion.staff_id == staff.id,
            models_pg.TrainingCompletion.module_id == module_id,
        )
    )
    completion = res.scalars().first()
    if completion:
        await db.delete(completion)
        await db.commit()
    return {"status": "removed"}
