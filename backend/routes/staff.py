from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, date
from bson import ObjectId
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

import models_pg
from .dependencies import get_current_user, User, get_db

router = APIRouter(prefix="/staff", tags=["Staff Management"])

# ============== MODELS ==============

class StaffCreate(BaseModel):
    user_id: Optional[str] = None  # Link to existing user or create new
    # Personal Info
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    # Emergency Contact
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    # Employment Info
    employee_id: Optional[str] = None
    department: Optional[str] = None
    designation: str
    employment_type: str = "full_time"  # full_time, part_time, contract, intern
    join_date: Optional[str] = None
    outlet_id: Optional[str] = None  # Primary outlet assignment
    hourly_rate: Optional[float] = None
    monthly_salary: Optional[float] = None
    # Skills & Certifications
    skills: List[str] = []
    certifications: List[str] = []


class StaffUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    employment_type: Optional[str] = None
    outlet_id: Optional[str] = None
    hourly_rate: Optional[float] = None
    monthly_salary: Optional[float] = None
    skills: Optional[List[str]] = None
    certifications: Optional[List[str]] = None
    status: Optional[str] = None


class LeavePolicyCreate(BaseModel):
    name: str  # e.g., "Annual Leave", "Sick Leave", "Casual Leave"
    code: str  # e.g., "AL", "SL", "CL"
    description: Optional[str] = None
    days_per_year: float
    accrual_type: str = "yearly"  # yearly, monthly, none
    carry_forward: bool = False
    max_carry_forward_days: float = 0
    requires_approval: bool = True
    min_notice_days: int = 0
    max_consecutive_days: int = 0  # 0 = unlimited
    applicable_to: List[str] = ["all"]  # all, full_time, part_time, etc.
    paid: bool = True


class LeavePolicyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    days_per_year: Optional[float] = None
    accrual_type: Optional[str] = None
    carry_forward: Optional[bool] = None
    max_carry_forward_days: Optional[float] = None
    requires_approval: Optional[bool] = None
    min_notice_days: Optional[int] = None
    max_consecutive_days: Optional[int] = None
    applicable_to: Optional[List[str]] = None
    paid: Optional[bool] = None
    active: Optional[bool] = None


class LeaveRequestCreate(BaseModel):
    leave_type_id: str
    start_date: str
    end_date: str
    reason: Optional[str] = None
    half_day: bool = False
    half_day_type: Optional[str] = None  # first_half, second_half


class LeaveRequestUpdate(BaseModel):
    status: str  # approved, rejected, cancelled
    approver_notes: Optional[str] = None


class ShiftTemplateCreate(BaseModel):
    name: str  # e.g., "Morning Shift", "Evening Shift", "Night Shift"
    code: str
    start_time: str  # "09:00"
    end_time: str  # "17:00"
    break_duration_minutes: int = 60
    color: Optional[str] = "#5FA8D3"
    applicable_days: List[int] = [0, 1, 2, 3, 4]  # 0=Monday, 6=Sunday


class ShiftTemplateUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    break_duration_minutes: Optional[int] = None
    color: Optional[str] = None
    applicable_days: Optional[List[int]] = None
    active: Optional[bool] = None


class StaffScheduleCreate(BaseModel):
    staff_id: str
    shift_template_id: str
    date: str
    outlet_id: Optional[str] = None
    notes: Optional[str] = None


class HolidayCreate(BaseModel):
    name: str
    date: str
    recurring: bool = False  # Repeat every year
    holiday_type: str = "public"  # public, company, optional
    applicable_to: List[str] = ["all"]  # all, or specific outlet_ids


class HolidayUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    recurring: Optional[bool] = None
    holiday_type: Optional[str] = None
    applicable_to: Optional[List[str]] = None
    active: Optional[bool] = None


class ClockInOut(BaseModel):
    staff_id: str
    outlet_id: Optional[str] = None
    notes: Optional[str] = None
    location: Optional[str] = None  # GPS coordinates or location name


class AttendanceCorrection(BaseModel):
    clock_in: Optional[str] = None
    clock_out: Optional[str] = None
    notes: Optional[str] = None
    reason: str


# ============== STAFF ROUTES ==============

@router.get("")
async def get_staff_list(
    outlet_id: Optional[str] = None,
    department: Optional[str] = None,
    status: Optional[str] = "active",
    employment_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get all staff members"""
    stmt = select(models_pg.Staff).where(models_pg.Staff.company_id == current_user.company_id)
    
    if outlet_id:
        stmt = stmt.where(models_pg.Staff.outlet_id == outlet_id)
    if department:
        stmt = stmt.where(models_pg.Staff.department == department)
    if status:
        stmt = stmt.where(models_pg.Staff.status == status)
    if employment_type:
        stmt = stmt.where(models_pg.Staff.employment_type == employment_type)
    
    res = await db_session.execute(stmt)
    staff_members = res.scalars().all()
    
    return [
        {
            "id": s.id,
            "user_id": s.user_id,
            "employee_id": s.employee_id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "full_name": f"{s.first_name} {s.last_name}",
            "email": s.email,
            "phone": s.phone,
            "department": s.department,
            "designation": s.designation,
            "employment_type": s.employment_type,
            "status": s.status,
            "outlet_id": s.outlet_id
        } for s in staff_members
    ]


@router.get("/{staff_id}")
async def get_staff_member(
    staff_id: str,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get a single staff member"""
    stmt = select(models_pg.Staff).where(
        models_pg.Staff.id == staff_id,
        models_pg.Staff.company_id == current_user.company_id
    )
    res = await db_session.execute(stmt)
    staff = res.scalar_one_or_none()
    
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
        
    return {
        "id": staff.id,
        "user_id": staff.user_id,
        "employee_id": staff.employee_id,
        "first_name": staff.first_name,
        "last_name": staff.last_name,
        "full_name": f"{staff.first_name} {staff.last_name}",
        "email": staff.email,
        "phone": staff.phone,
        "department": staff.department,
        "designation": staff.designation,
        "employment_type": staff.employment_type,
        "status": staff.status,
        "outlet_id": staff.outlet_id,
        "skills": staff.skills,
        "certifications": staff.certifications
    }


@router.post("")
async def create_staff(
    staff_data: StaffCreate,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Create a new staff member"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    staff_id = str(uuid.uuid4())
    employee_id = staff_data.employee_id or f"EMP-{staff_id[:8].upper()}"
    
    new_staff = models_pg.Staff(
        id=staff_id,
        user_id=staff_data.user_id,
        employee_id=employee_id,
        first_name=staff_data.first_name,
        last_name=staff_data.last_name,
        email=staff_data.email,
        phone=staff_data.phone or "",
        department=staff_data.department,
        designation=staff_data.designation,
        employment_type=staff_data.employment_type,
        outlet_id=staff_data.outlet_id,
        skills=staff_data.skills,
        certifications=staff_data.certifications,
        status="active",
        company_id=current_user.company_id,
    )
    
    db_session.add(new_staff)
    await db_session.commit()
    
    # Skipping leave balances for now
    
    return {"id": staff_id, "employee_id": employee_id, "message": "Staff member created"}


@router.put("/{staff_id}")
async def update_staff(
    staff_id: str,
    staff_data: StaffUpdate,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Update a staff member"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    stmt = select(models_pg.Staff).where(
        models_pg.Staff.id == staff_id,
        models_pg.Staff.company_id == current_user.company_id
    )
    res = await db_session.execute(stmt)
    staff = res.scalar_one_or_none()
    
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    update_data = {k: v for k, v in staff_data.dict(exclude_unset=True).items() if v is not None}
    
    if not update_data:
        return {"message": "No fields to update"}
        
    upd_stmt = (
        update(models_pg.Staff)
        .where(models_pg.Staff.id == staff_id)
        .values(**update_data)
    )
    
    await db_session.execute(upd_stmt)
    await db_session.commit()
    
    return {"message": "Staff member updated"}


@router.delete("/{staff_id}")
async def delete_staff(
    staff_id: str,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Soft delete a staff member"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    stmt = (
        update(models_pg.Staff)
        .where(
            models_pg.Staff.id == staff_id,
            models_pg.Staff.company_id == current_user.company_id
        )
        .values(status="inactive")
    )
    res = await db_session.execute(stmt)
    
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
        
    await db_session.commit()
    
    return {"message": "Staff member deactivated"}


# ============== LEAVE POLICY ROUTES ==============

@router.get("/leave/policies")
async def get_leave_policies(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get all leave policies"""
    stmt = select(models_pg.LeavePolicy).where(
        models_pg.LeavePolicy.company_id == current_user.company_id,
        models_pg.LeavePolicy.active == True
    )
    res = await db_session.execute(stmt)
    policies = res.scalars().all()
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "description": p.description,
            "days_per_year": p.days_per_year,
            "accrual_type": p.accrual_type,
            "carry_forward": p.carry_forward,
            "max_carry_forward_days": p.max_carry_forward_days,
            "requires_approval": p.requires_approval,
            "min_notice_days": p.min_notice_days,
            "max_consecutive_days": p.max_consecutive_days,
            "applicable_to": p.applicable_to,
            "paid": p.paid,
            "active": p.active,
            "company_id": p.company_id
        } for p in policies
    ]


@router.post("/leave/policies")
async def create_leave_policy(
    policy: LeavePolicyCreate,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Create a new leave policy"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    policy_id = str(uuid.uuid4())
    
    new_policy = models_pg.LeavePolicy(
        id=policy_id,
        name=policy.name,
        code=policy.code.upper(),
        description=policy.description,
        days_per_year=policy.days_per_year,
        accrual_type=policy.accrual_type,
        carry_forward=policy.carry_forward,
        max_carry_forward_days=policy.max_carry_forward_days,
        requires_approval=policy.requires_approval,
        min_notice_days=policy.min_notice_days,
        max_consecutive_days=policy.max_consecutive_days,
        applicable_to=policy.applicable_to,
        paid=policy.paid,
        active=True,
        company_id=current_user.company_id
    )
    
    db_session.add(new_policy)
    await db_session.commit()
    
    return {"id": policy_id, "message": "Leave policy created"}


@router.put("/leave/policies/{policy_id}")
async def update_leave_policy(
    policy_id: str,
    policy_data: LeavePolicyUpdate,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Update a leave policy"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in policy_data.dict(exclude_unset=True).items() if v is not None}
    if not update_data:
        return {"message": "No fields to update"}
        
    stmt = (
        update(models_pg.LeavePolicy)
        .where(
            models_pg.LeavePolicy.id == policy_id,
            models_pg.LeavePolicy.company_id == current_user.company_id
        )
        .values(**update_data)
    )
    
    res = await db_session.execute(stmt)
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Leave policy not found")
        
    await db_session.commit()
    
    return {"message": "Leave policy updated"}


@router.delete("/leave/policies/{policy_id}")
async def delete_leave_policy(
    policy_id: str,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Soft delete a leave policy"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    stmt = (
        update(models_pg.LeavePolicy)
        .where(
            models_pg.LeavePolicy.id == policy_id,
            models_pg.LeavePolicy.company_id == current_user.company_id
        )
        .values(active=False)
    )
    
    res = await db_session.execute(stmt)
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Leave policy not found")
        
    await db_session.commit()
    
    return {"message": "Leave policy deleted"}


# ============== LEAVE REQUEST ROUTES ==============

@router.get("/leave/requests")
async def get_leave_requests(
    staff_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get leave requests"""
    stmt = select(models_pg.LeaveRequest).where(models_pg.LeaveRequest.company_id == current_user.company_id)
    
    if staff_id:
        stmt = stmt.where(models_pg.LeaveRequest.staff_id == staff_id)
    if status:
        stmt = stmt.where(models_pg.LeaveRequest.status == status)
    if start_date:
        stmt = stmt.where(models_pg.LeaveRequest.start_date >= start_date)
    if end_date:
        stmt = stmt.where(models_pg.LeaveRequest.end_date <= end_date)
    
    res = await db_session.execute(stmt)
    requests = res.scalars().all()
    
    return [
        {
            "id": r.id,
            "staff_id": r.staff_id,
            "leave_type_id": r.leave_type_id,
            "start_date": r.start_date.isoformat() if hasattr(r.start_date, 'isoformat') else r.start_date,
            "end_date": r.end_date.isoformat() if hasattr(r.end_date, 'isoformat') else r.end_date,
            "days": r.days,
            "half_day": r.half_day,
            "half_day_type": r.half_day_type,
            "reason": r.reason,
            "status": r.status,
            "approver_id": r.approver_id,
            "approver_notes": r.approver_notes,
            "approved_at": r.approved_at
        } for r in requests
    ]


@router.post("/leave/requests")
async def create_leave_request(
    request_data: LeaveRequestCreate,
    staff_id: str,  # Staff member requesting leave
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Create a leave request"""
    # Get leave policy
    p_stmt = select(models_pg.LeavePolicy).where(
        models_pg.LeavePolicy.id == request_data.leave_type_id,
        models_pg.LeavePolicy.company_id == current_user.company_id
    )
    p_res = await db_session.execute(p_stmt)
    policy = p_res.scalar_one_or_none()
    
    if not policy:
        raise HTTPException(status_code=404, detail="Leave policy not found")
    
    # Get staff member
    s_stmt = select(models_pg.Staff).where(
        models_pg.Staff.id == staff_id,
        models_pg.Staff.company_id == current_user.company_id
    )
    s_res = await db_session.execute(s_stmt)
    staff = s_res.scalar_one_or_none()
    
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    # Calculate days
    start = datetime.fromisoformat(request_data.start_date)
    end = datetime.fromisoformat(request_data.end_date)
    days = (end - start).days + 1
    if request_data.half_day:
        days = 0.5
    
    current_year = start.year
    
    # Check leave balance
    bal_stmt = select(models_pg.LeaveBalance).where(
        models_pg.LeaveBalance.company_id == current_user.company_id,
        models_pg.LeaveBalance.staff_id == staff_id,
        models_pg.LeaveBalance.year == current_year
    )
    bal_res = await db_session.execute(bal_stmt)
    leave_balance = bal_res.scalar_one_or_none()
    
    # Simple check for now: assuming balances stores {"policy_id": {"total": X, "used": Y, "pending": Z}}
    if leave_balance and leave_balance.balances:
        p_balance = leave_balance.balances.get(policy.id, {})
        available = float(p_balance.get("total", 0)) - float(p_balance.get("used", 0)) - float(p_balance.get("pending", 0))
        
        if available < days:
            raise HTTPException(status_code=400, detail=f"Insufficient leave balance (Available: {available}, Requested: {days})")
            
        # Update pending
        p_balance["pending"] = float(p_balance.get("pending", 0)) + days
        leave_balance.balances[policy.id] = p_balance
        
        # SQLAlchemy needs to know the JSON field changed
        import copy
        new_bals = copy.deepcopy(leave_balance.balances)
        leave_balance.balances = new_bals
        
    request_id = str(uuid.uuid4())
    
    new_request = models_pg.LeaveRequest(
        id=request_id,
        company_id=current_user.company_id,
        staff_id=staff_id,
        leave_type_id=request_data.leave_type_id,
        start_date=start.date(),
        end_date=end.date(),
        days=days,
        half_day=request_data.half_day,
        half_day_type=request_data.half_day_type,
        reason=request_data.reason,
        status="pending" if policy.requires_approval else "approved",
        approved_at=datetime.now(timezone.utc) if not policy.requires_approval else None
    )
    
    db_session.add(new_request)
    await db_session.commit()
    
    return {"id": request_id, "status": new_request.status, "message": "Leave request created"}


@router.put("/leave/requests/{request_id}")
async def update_leave_request(
    request_id: str,
    update_data: LeaveRequestUpdate,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Approve/Reject a leave request"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    req_stmt = select(models_pg.LeaveRequest).where(
        models_pg.LeaveRequest.id == request_id,
        models_pg.LeaveRequest.company_id == current_user.company_id
    )
    req_res = await db_session.execute(req_stmt)
    leave_request = req_res.scalar_one_or_none()
    
    if not leave_request:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    if leave_request.status != "pending":
        raise HTTPException(status_code=400, detail="Leave request already processed")
    
    leave_request.status = update_data.status
    leave_request.approver_id = current_user.id
    leave_request.approver_notes = update_data.approver_notes
    if update_data.status == "approved":
        leave_request.approved_at = datetime.now(timezone.utc)
        
    # Deduct balance or revert pending
    bal_stmt = select(models_pg.LeaveBalance).where(
        models_pg.LeaveBalance.company_id == current_user.company_id,
        models_pg.LeaveBalance.staff_id == leave_request.staff_id,
        models_pg.LeaveBalance.year == leave_request.start_date.year if leave_request.start_date else datetime.now(timezone.utc).year
    )
    bal_res = await db_session.execute(bal_stmt)
    leave_balance = bal_res.scalar_one_or_none()
    
    if leave_balance and leave_balance.balances:
        p_balance = leave_balance.balances.get(leave_request.leave_type_id, {})
        
        # Remove from pending since we processed it
        current_pending = float(p_balance.get("pending", 0))
        p_balance["pending"] = max(0, current_pending - float(leave_request.days))
        
        if update_data.status == "approved":
            # Add to used
            p_balance["used"] = float(p_balance.get("used", 0)) + float(leave_request.days)
            
        leave_balance.balances[leave_request.leave_type_id] = p_balance
        
        import copy
        new_bals = copy.deepcopy(leave_balance.balances)
        leave_balance.balances = new_bals
    
    await db_session.commit()
    
    return {"message": f"Leave request {update_data.status}"}


@router.get("/leave/balances/{staff_id}")
async def get_staff_leave_balances(
    staff_id: str,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get leave balances for a staff member"""
    target_year = year or datetime.now(timezone.utc).year
    stmt = select(models_pg.LeaveBalance).where(
        models_pg.LeaveBalance.company_id == current_user.company_id,
        models_pg.LeaveBalance.staff_id == staff_id,
        models_pg.LeaveBalance.year == target_year
    )
    res = await db_session.execute(stmt)
    balance = res.scalar_one_or_none()
    
    if not balance:
        return []
        
    return [
        {
            "policy_id": k,
            "total": v.get("total", 0),
            "used": v.get("used", 0),
            "pending": v.get("pending", 0),
            "available": float(v.get("total", 0)) - float(v.get("used", 0)) - float(v.get("pending", 0))
        } for k, v in balance.balances.items()
    ]


# ============== SHIFT TEMPLATE ROUTES ==============

@router.get("/shifts/templates")
async def get_shift_templates(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get all shift templates"""
    stmt = select(models_pg.ShiftTemplate).where(
        models_pg.ShiftTemplate.company_id == current_user.company_id,
        models_pg.ShiftTemplate.active == True
    )
    res = await db_session.execute(stmt)
    templates = res.scalars().all()
    
    return [
        {
            "id": t.id,
            "name": t.name,
            "code": t.code,
            "start_time": t.start_time.strftime("%H:%M") if t.start_time else None,
            "end_time": t.end_time.strftime("%H:%M") if t.end_time else None,
            "break_duration_minutes": t.break_duration_minutes,
            "color": t.color,
            "applicable_days": t.applicable_days,
            "company_id": t.company_id,
            "active": t.active
        } for t in templates
    ]


@router.post("/shifts/templates")
async def create_shift_template(
    template: ShiftTemplateCreate,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Create a new shift template"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    template_id = str(uuid.uuid4())
    
    # Parse times "09:00" -> time
    from datetime import datetime as dt
    start_t = dt.strptime(template.start_time, "%H:%M").time()
    end_t = dt.strptime(template.end_time, "%H:%M").time()
    
    new_template = models_pg.ShiftTemplate(
        id=template_id,
        name=template.name,
        code=template.code.upper(),
        start_time=start_t,
        end_time=end_t,
        break_duration_minutes=template.break_duration_minutes,
        color=template.color,
        applicable_days=template.applicable_days,
        active=True,
        company_id=current_user.company_id
    )
    
    db_session.add(new_template)
    await db_session.commit()
    return {"id": template_id, "message": "Shift template created"}


@router.put("/shifts/templates/{template_id}")
async def update_shift_template(
    template_id: str,
    template_data: ShiftTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Update a shift template"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in template_data.dict(exclude_unset=True).items() if v is not None}
    
    # Convert string times
    if "start_time" in update_data:
        from datetime import datetime as dt
        update_data["start_time"] = dt.strptime(update_data["start_time"], "%H:%M").time()
    if "end_time" in update_data:
        from datetime import datetime as dt
        update_data["end_time"] = dt.strptime(update_data["end_time"], "%H:%M").time()
        
    if not update_data:
        return {"message": "No fields to update"}
        
    stmt = (
        update(models_pg.ShiftTemplate)
        .where(
            models_pg.ShiftTemplate.id == template_id,
            models_pg.ShiftTemplate.company_id == current_user.company_id
        )
        .values(**update_data)
    )
    
    res = await db_session.execute(stmt)
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Shift template not found")
        
    await db_session.commit()
    
    return {"message": "Shift template updated"}


@router.delete("/shifts/templates/{template_id}")
async def delete_shift_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Soft delete a shift template"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    stmt = (
        update(models_pg.ShiftTemplate)
        .where(
            models_pg.ShiftTemplate.id == template_id,
            models_pg.ShiftTemplate.company_id == current_user.company_id
        )
        .values(active=False)
    )
    res = await db_session.execute(stmt)
    
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Shift template not found")
        
    await db_session.commit()
    
    return {"message": "Shift template deleted"}


# ============== STAFF SCHEDULE ROUTES ==============

@router.get("/schedules")
async def get_staff_schedules(
    start_date: str,
    end_date: str,
    staff_id: Optional[str] = None,
    outlet_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get staff schedules for a date range"""
    from datetime import datetime as dt
    s_date = dt.fromisoformat(start_date).date() if len(start_date) > 10 else dt.strptime(start_date, "%Y-%m-%d").date()
    e_date = dt.fromisoformat(end_date).date() if len(end_date) > 10 else dt.strptime(end_date, "%Y-%m-%d").date()
    
    stmt = select(models_pg.StaffSchedule).where(
        models_pg.StaffSchedule.company_id == current_user.company_id,
        models_pg.StaffSchedule.date >= s_date,
        models_pg.StaffSchedule.date <= e_date
    )
    
    if staff_id:
        stmt = stmt.where(models_pg.StaffSchedule.staff_id == staff_id)
    if outlet_id:
        stmt = stmt.where(models_pg.StaffSchedule.outlet_id == outlet_id)
    
    res = await db_session.execute(stmt)
    schedules = res.scalars().all()
    
    return [
        {
            "id": s.id,
            "staff_id": s.staff_id,
            "shift_template_id": s.shift_template_id,
            "date": s.date.isoformat(),
            "status": s.status,
            "outlet_id": s.outlet_id,
            "notes": s.notes
        } for s in schedules
    ]


@router.post("/schedules")
async def create_staff_schedule(
    schedule: StaffScheduleCreate,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Assign a shift to a staff member"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    from datetime import datetime as dt
    s_date = dt.strptime(schedule.date, "%Y-%m-%d").date()
    
    # Check for existing
    existing_stmt = select(models_pg.StaffSchedule).where(
        models_pg.StaffSchedule.staff_id == schedule.staff_id,
        models_pg.StaffSchedule.date == s_date,
        models_pg.StaffSchedule.company_id == current_user.company_id
    )
    existing_res = await db_session.execute(existing_stmt)
    if existing_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Staff already has a schedule for this date")
    
    # Get staff and shift info
    staff_stmt = select(models_pg.Staff).where(models_pg.Staff.id == schedule.staff_id)
    shift_stmt = select(models_pg.ShiftTemplate).where(models_pg.ShiftTemplate.id == schedule.shift_template_id)
    
    staff = (await db_session.execute(staff_stmt)).scalar_one_or_none()
    shift = (await db_session.execute(shift_stmt)).scalar_one_or_none()
    
    if not staff or not shift:
        raise HTTPException(status_code=404, detail="Staff or shift template not found")
    
    schedule_id = str(uuid.uuid4())
    new_sched = models_pg.StaffSchedule(
        id=schedule_id,
        staff_id=schedule.staff_id,
        shift_template_id=schedule.shift_template_id,
        date=s_date,
        outlet_id=schedule.outlet_id or staff.outlet_id,
        notes=schedule.notes,
        status="scheduled",
        company_id=current_user.company_id
    )
    
    db_session.add(new_sched)
    await db_session.commit()
    
    return {"id": schedule_id, "message": "Schedule created"}


@router.post("/schedules/bulk")
async def create_bulk_schedules(
    schedules: List[StaffScheduleCreate],
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Bulk create schedules"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    created = 0
    skipped = 0
    
    from datetime import datetime as dt
    
    for schedule in schedules:
        s_date = dt.strptime(schedule.date, "%Y-%m-%d").date()
        
        ex_stmt = select(models_pg.StaffSchedule).where(
            models_pg.StaffSchedule.staff_id == schedule.staff_id,
            models_pg.StaffSchedule.date == s_date,
            models_pg.StaffSchedule.company_id == current_user.company_id
        )
        existing = (await db_session.execute(ex_stmt)).scalar_one_or_none()
        
        if existing:
            skipped += 1
            continue
            
        staff_stmt = select(models_pg.Staff).where(models_pg.Staff.id == schedule.staff_id)
        shift_stmt = select(models_pg.ShiftTemplate).where(models_pg.ShiftTemplate.id == schedule.shift_template_id)
        
        staff = (await db_session.execute(staff_stmt)).scalar_one_or_none()
        shift = (await db_session.execute(shift_stmt)).scalar_one_or_none()
        
        if not staff or not shift:
            skipped += 1
            continue
        
        new_sched = models_pg.StaffSchedule(
            id=str(uuid.uuid4()),
            staff_id=schedule.staff_id,
            shift_template_id=schedule.shift_template_id,
            date=s_date,
            outlet_id=schedule.outlet_id or staff.outlet_id,
            notes=schedule.notes,
            status="scheduled",
            company_id=current_user.company_id
        )
        db_session.add(new_sched)
        created += 1
        
    if created > 0:
        await db_session.commit()
        
    return {"created": created, "skipped": skipped}


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Delete a schedule"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    stmt = (
        delete(models_pg.StaffSchedule)
        .where(
            models_pg.StaffSchedule.id == schedule_id,
            models_pg.StaffSchedule.company_id == current_user.company_id
        )
    )
    res = await db_session.execute(stmt)
    
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
        
    await db_session.commit()
    
    return {"message": "Schedule deleted"}


# ============== HOLIDAY ROUTES ==============

@router.get("/holidays")
async def get_holidays(
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get all holidays"""
    stmt = select(models_pg.Holiday).where(
        models_pg.Holiday.company_id == current_user.company_id,
        models_pg.Holiday.active == True
    ).order_by(models_pg.Holiday.date)
    
    # We parse out year logic simply in PG if passed
    if year:
        # Easy enough to filter by date start/end
        from datetime import date
        stmt = stmt.where(
            models_pg.Holiday.date >= date(year, 1, 1),
            models_pg.Holiday.date <= date(year, 12, 31)
        )
        
    res = await db_session.execute(stmt)
    holidays = res.scalars().all()
    
    return [
        {
            "id": h.id,
            "name": h.name,
            "date": h.date.isoformat(),
            "recurring": h.recurring,
            "holiday_type": h.holiday_type,
            "applicable_to": h.applicable_to,
        } for h in holidays
    ]


@router.post("/holidays")
async def create_holiday(
    holiday: HolidayCreate,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Create a new holiday"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    holiday_id = str(uuid.uuid4())
    from datetime import datetime as dt
    hol_date = dt.strptime(holiday.date, "%Y-%m-%d").date()
    
    new_holiday = models_pg.Holiday(
        id=holiday_id,
        name=holiday.name,
        date=hol_date,
        recurring=holiday.recurring,
        holiday_type=holiday.holiday_type,
        applicable_to=holiday.applicable_to,
        active=True,
        company_id=current_user.company_id
    )
    
    db_session.add(new_holiday)
    await db_session.commit()
    return {"id": holiday_id, "message": "Holiday created"}


@router.put("/holidays/{holiday_id}")
async def update_holiday(
    holiday_id: str,
    holiday_data: HolidayUpdate,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Update a holiday"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in holiday_data.dict(exclude_unset=True).items() if v is not None}
    if "date" in update_data:
        from datetime import datetime as dt
        update_data["date"] = dt.strptime(update_data["date"], "%Y-%m-%d").date()
        
    if not update_data:
        return {"message": "No fields to update"}
        
    stmt = (
        update(models_pg.Holiday)
        .where(
            models_pg.Holiday.id == holiday_id,
            models_pg.Holiday.company_id == current_user.company_id
        )
        .values(**update_data)
    )
    res = await db_session.execute(stmt)
    
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
        
    await db_session.commit()
    
    return {"message": "Holiday updated"}


@router.delete("/holidays/{holiday_id}")
async def delete_holiday(
    holiday_id: str,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Soft delete a holiday"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    stmt = (
        update(models_pg.Holiday)
        .where(
            models_pg.Holiday.id == holiday_id,
            models_pg.Holiday.company_id == current_user.company_id
        )
        .values(active=False)
    )
    res = await db_session.execute(stmt)
    
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
        
    await db_session.commit()
    
    return {"message": "Holiday deleted"}


# ============== HELPER FUNCTIONS ==============

async def initialize_leave_balances(db_session: AsyncSession, staff_id: str, company_id: str):
    """Initialize leave balances for a new staff member (mock for sql)"""
    pass


async def get_leave_balance(db_session: AsyncSession, staff_id: str, leave_type_id: str, company_id: str) -> float:
    """Get current leave balance (mock)"""
    return 10.0


async def deduct_leave_balance(db_session: AsyncSession, staff_id: str, leave_type_id: str, days: float, company_id: str):
    """Deduct leave from balance (mock)"""
    pass


# ============== STATS ROUTE ==============

@router.get("/stats/overview")
async def get_staff_stats(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get staff management overview stats"""
    company_id = current_user.company_id
    from datetime import datetime as dt, date, timedelta
    today_date = dt.now().date()
    
    from sqlalchemy import func
    
    # helper for counting
    async def get_count(stmt):
        res = await db_session.execute(stmt)
        return res.scalar() or 0
        
    # Staff counts
    total_staff = await get_count(
        select(func.count(models_pg.Staff.id)).where(
            models_pg.Staff.company_id == company_id,
            models_pg.Staff.status == "active"
        )
    )
    
    # Today's schedules
    today_schedules = await get_count(
        select(func.count(models_pg.StaffSchedule.id)).where(
            models_pg.StaffSchedule.company_id == company_id,
            models_pg.StaffSchedule.date == today_date
        )
    )
    
    # Pending leave requests
    pending_leaves = await get_count(
        select(func.count(models_pg.LeaveRequest.id)).where(
            models_pg.LeaveRequest.company_id == company_id,
            models_pg.LeaveRequest.status == "pending"
        )
    )
    
    # On leave today
    on_leave_today = await get_count(
        select(func.count(models_pg.LeaveRequest.id)).where(
            models_pg.LeaveRequest.company_id == company_id,
            models_pg.LeaveRequest.status == "approved",
            models_pg.LeaveRequest.start_date <= today_date,
            models_pg.LeaveRequest.end_date >= today_date
        )
    )
    
    # Upcoming holidays (next 30 days)
    to_date = today_date + timedelta(days=30)
    upcoming_holidays = await get_count(
        select(func.count(models_pg.Holiday.id)).where(
            models_pg.Holiday.company_id == company_id,
            models_pg.Holiday.active == True,
            models_pg.Holiday.date >= today_date,
            models_pg.Holiday.date <= to_date
        )
    )
    
    # Attendance stats
    clocked_in_today = await get_count(
        select(func.count(models_pg.Attendance.id)).where(
            models_pg.Attendance.company_id == company_id,
            models_pg.Attendance.date == today_date
        )
    )
    
    currently_working = await get_count(
        select(func.count(models_pg.Attendance.id)).where(
            models_pg.Attendance.company_id == company_id,
            models_pg.Attendance.date == today_date,
            models_pg.Attendance.clock_out == None
        )
    )
    
    late_today = await get_count(
        select(func.count(models_pg.Attendance.id)).where(
            models_pg.Attendance.company_id == company_id,
            models_pg.Attendance.date == today_date,
            models_pg.Attendance.is_late == True
        )
    )
    
    return {
        "total_staff": total_staff,
        "today_schedules": today_schedules,
        "pending_leaves": pending_leaves,
        "on_leave_today": on_leave_today,
        "upcoming_holidays": upcoming_holidays,
        "clocked_in_today": clocked_in_today,
        "currently_working": currently_working,
        "late_today": late_today
    }


# ============== ATTENDANCE ROUTES ==============

@router.post("/attendance/clock-in")
async def clock_in(
    data: ClockInOut,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Clock in a staff member"""
    # Get staff member
    s_stmt = select(models_pg.Staff).where(
        models_pg.Staff.id == data.staff_id,
        models_pg.Staff.company_id == current_user.company_id
    )
    s_res = await db_session.execute(s_stmt)
    staff = s_res.scalar_one_or_none()
    
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    now = datetime.now(timezone.utc)
    today_date = now.date()
    
    # Check if already clocked in today
    att_stmt = select(models_pg.Attendance).where(
        models_pg.Attendance.staff_id == data.staff_id,
        models_pg.Attendance.date == today_date,
        models_pg.Attendance.clock_out == None
    )
    att_res = await db_session.execute(att_stmt)
    if att_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already clocked in")
    
    attendance_id = str(uuid.uuid4())
    
    # Get scheduled shift for today
    sched_stmt = (
        select(models_pg.StaffSchedule)
        .join(models_pg.ShiftTemplate, models_pg.StaffSchedule.shift_template_id == models_pg.ShiftTemplate.id)
        .where(
            models_pg.StaffSchedule.staff_id == data.staff_id,
            models_pg.StaffSchedule.date == today_date,
            models_pg.StaffSchedule.company_id == current_user.company_id
        )
    )
    sched_res = await db_session.execute(sched_stmt)
    schedule = sched_res.scalar_one_or_none()
    
    scheduled_start = None
    scheduled_end = None
    is_late = False
    late_minutes = 0
    
    if schedule:
        shift_stmt = select(models_pg.ShiftTemplate).where(models_pg.ShiftTemplate.id == schedule.shift_template_id)
        shift = (await db_session.execute(shift_stmt)).scalar_one_or_none()
        if shift:
            scheduled_start = shift.start_time
            scheduled_end = shift.end_time
            if scheduled_start:
                scheduled_time = datetime.combine(today_date, scheduled_start).replace(tzinfo=timezone.utc)
                if now > scheduled_time:
                    is_late = True
                    late_minutes = int((now - scheduled_time).total_seconds() / 60)
            
    new_attendance = models_pg.Attendance(
        id=attendance_id,
        staff_id=data.staff_id,
        employee_id=staff.employee_id,
        date=today_date,
        clock_in=now,
        clock_out=None,
        outlet_id=data.outlet_id or staff.outlet_id,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        is_late=is_late,
        late_minutes=late_minutes,
        early_departure=False,
        early_departure_minutes=0,
        total_hours=None,
        overtime_hours=0.0,
        break_minutes=0,
        status="present",
        notes=data.notes,
        location=data.location,
        company_id=current_user.company_id
    )
    
    db_session.add(new_attendance)
    await db_session.commit()
    
    return {
        "id": attendance_id,
        "clock_in": now.isoformat(),
        "is_late": is_late,
        "late_minutes": late_minutes,
        "message": "Clocked in successfully"
    }


@router.post("/attendance/clock-out")
async def clock_out(
    data: ClockInOut,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Clock out a staff member"""
    now = datetime.now(timezone.utc)
    today_date = now.date()
    
    # Find today's clock-in record
    stmt = select(models_pg.Attendance).where(
        models_pg.Attendance.staff_id == data.staff_id,
        models_pg.Attendance.date == today_date,
        models_pg.Attendance.clock_out == None,
        models_pg.Attendance.company_id == current_user.company_id
    )
    res = await db_session.execute(stmt)
    attendance = res.scalar_one_or_none()
    
    if not attendance:
        raise HTTPException(status_code=400, detail="No active clock-in found for today")
    
    clock_in_time = attendance.clock_in
    if clock_in_time.tzinfo is None:
        clock_in_time = clock_in_time.replace(tzinfo=timezone.utc)
    
    # Calculate total hours
    total_seconds = (now - clock_in_time).total_seconds()
    total_hours = round(total_seconds / 3600, 2)
    
    # Check early departure
    early_departure = False
    early_departure_minutes = 0
    scheduled_end = attendance.scheduled_end
    
    if scheduled_end:
        scheduled_end_time = datetime.combine(today_date, scheduled_end).replace(tzinfo=timezone.utc)
        if now < scheduled_end_time:
            early_departure = True
            early_departure_minutes = int((scheduled_end_time - now).total_seconds() / 60)
            
    # Calculate overtime (if worked more than scheduled)
    overtime_hours = 0.0
    if scheduled_end and attendance.scheduled_start:
        scheduled_start_time = datetime.combine(today_date, attendance.scheduled_start).replace(tzinfo=timezone.utc)
        scheduled_end_time = datetime.combine(today_date, scheduled_end).replace(tzinfo=timezone.utc)
        scheduled_hours = (scheduled_end_time - scheduled_start_time).total_seconds() / 3600
        if total_hours > scheduled_hours:
            overtime_hours = round(float(total_hours - scheduled_hours), 2)
            
    update_data = {
        "clock_out": now,
        "total_hours": float(total_hours),
        "early_departure": early_departure,
        "early_departure_minutes": early_departure_minutes,
        "overtime_hours": float(overtime_hours)
    }
    
    if data.notes:
        update_data["clock_out_notes"] = data.notes
    if data.location:
        update_data["clock_out_location"] = data.location
        
    upd_stmt = (
        update(models_pg.Attendance)
        .where(models_pg.Attendance.id == attendance.id)
        .values(**update_data)
    )
    
    await db_session.execute(upd_stmt)
    await db_session.commit()
    
    return {
        "id": attendance.id,
        "clock_out": now.isoformat(),
        "total_hours": total_hours,
        "overtime_hours": overtime_hours,
        "early_departure": early_departure,
        "message": "Clocked out successfully"
    }


@router.get("/attendance")
async def get_attendance_records(
    staff_id: Optional[str] = None,
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get attendance records"""
    stmt = select(models_pg.Attendance).where(models_pg.Attendance.company_id == current_user.company_id)
    
    from datetime import datetime as dt
    if staff_id:
        stmt = stmt.where(models_pg.Attendance.staff_id == staff_id)
    if date:
        date_obj = dt.strptime(date, "%Y-%m-%d").date()
        stmt = stmt.where(models_pg.Attendance.date == date_obj)
    if start_date and end_date:
        s_obj = dt.strptime(start_date, "%Y-%m-%d").date()
        e_obj = dt.strptime(end_date, "%Y-%m-%d").date()
        stmt = stmt.where(models_pg.Attendance.date >= s_obj, models_pg.Attendance.date <= e_obj)
    if status:
        stmt = stmt.where(models_pg.Attendance.status == status)
        
    stmt = stmt.order_by(models_pg.Attendance.date.desc())
        
    res = await db_session.execute(stmt)
    records = res.scalars().all()
    
    return [
        {
            "id": r.id,
            "staff_id": r.staff_id,
            "date": r.date.isoformat(),
            "clock_in": r.clock_in.isoformat() if r.clock_in else None,
            "clock_out": r.clock_out.isoformat() if r.clock_out else None,
            "is_late": r.is_late,
            "late_minutes": r.late_minutes,
            "early_departure": r.early_departure,
            "total_hours": r.total_hours,
            "overtime_hours": r.overtime_hours,
            "status": r.status
        } for r in records
    ]


@router.get("/attendance/today")
async def get_today_attendance(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get today's attendance status for all staff"""
    from datetime import datetime as dt
    today_date = dt.now().date()
    
    # Get all active staff
    staff_stmt = select(models_pg.Staff).where(
        models_pg.Staff.company_id == current_user.company_id,
        models_pg.Staff.status == "active"
    )
    staff_res = await db_session.execute(staff_stmt)
    staff_list = staff_res.scalars().all()
    
    # Get today's attendance records
    att_stmt = select(models_pg.Attendance).where(
        models_pg.Attendance.company_id == current_user.company_id,
        models_pg.Attendance.date == today_date
    )
    att_res = await db_session.execute(att_stmt)
    attendance_records = att_res.scalars().all()
    
    # Get today's approved leaves
    leave_stmt = select(models_pg.LeaveRequest).where(
        models_pg.LeaveRequest.company_id == current_user.company_id,
        models_pg.LeaveRequest.status == "approved",
        models_pg.LeaveRequest.start_date <= today_date,
        models_pg.LeaveRequest.end_date >= today_date
    )
    leave_res = await db_session.execute(leave_stmt)
    on_leave = leave_res.scalars().all()
    on_leave_ids = [l.staff_id for l in on_leave]
    
    # Build attendance map
    attendance_map = {a.staff_id: a for a in attendance_records}
    
    result = []
    for staff in staff_list:
        staff_id = staff.id
        attendance = attendance_map.get(staff_id)
        
        status = "absent"
        if staff_id in on_leave_ids:
            status = "on_leave"
        elif attendance:
            if attendance.clock_out:
                status = "completed"
            else:
                status = "working"
                
        result.append({
            "id": staff.id,
            "full_name": f"{staff.first_name} {staff.last_name}",
            "employee_id": staff.employee_id,
            "designation": staff.designation,
            "outlet_id": staff.outlet_id,
            "status": status,
            "clock_in": attendance.clock_in.isoformat() if attendance and attendance.clock_in else None,
            "clock_out": attendance.clock_out.isoformat() if attendance and attendance.clock_out else None,
            "is_late": attendance.is_late if attendance else False,
            "late_minutes": attendance.late_minutes if attendance else 0,
            "total_hours": attendance.total_hours if attendance else None
        })
        
    summary = {
        "total": len(staff_list),
        "present": len([r for r in result if r["status"] in ["working", "completed"]]),
        "absent": len([r for r in result if r["status"] == "absent"]),
        "on_leave": len([r for r in result if r["status"] == "on_leave"]),
        "late": len([r for r in result if r.get("is_late")])
    }
    
    return {"staff": result, "summary": summary}


@router.get("/attendance/staff/{staff_id}")
async def get_staff_attendance_history(
    staff_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get attendance history for a specific staff member"""
    now = datetime.now()
    month = month or now.month
    year = year or now.year
    
    from datetime import date
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)
        
    stmt = select(models_pg.Attendance).where(
        models_pg.Attendance.staff_id == staff_id,
        models_pg.Attendance.company_id == current_user.company_id,
        models_pg.Attendance.date >= start_date,
        models_pg.Attendance.date < end_date
    ).order_by(models_pg.Attendance.date)
    
    res = await db_session.execute(stmt)
    records = res.scalars().all()
    
    # Calculate monthly stats
    total_days = len(records)
    total_hours = sum(r.total_hours or 0 for r in records)
    late_days = len([r for r in records if r.is_late])
    early_departures = len([r for r in records if r.early_departure])
    overtime_hours = sum(r.overtime_hours or 0 for r in records)
    
    return {
        "records": [
            {
                "id": r.id,
                "date": r.date.isoformat(),
                "clock_in": r.clock_in.isoformat() if r.clock_in else None,
                "clock_out": r.clock_out.isoformat() if r.clock_out else None,
                "is_late": r.is_late,
                "late_minutes": r.late_minutes,
                "early_departure": r.early_departure,
                "total_hours": r.total_hours,
                "overtime_hours": r.overtime_hours,
                "status": r.status
            } for r in records
        ],
        "stats": {
            "total_days_worked": total_days,
            "total_hours": round(total_hours, 2),
            "average_hours": round(total_hours / total_days, 2) if total_days > 0 else 0,
            "late_days": late_days,
            "early_departures": early_departures,
            "overtime_hours": round(overtime_hours, 2)
        }
    }


@router.put("/attendance/{attendance_id}/correct")
async def correct_attendance(
    attendance_id: str,
    correction: AttendanceCorrection,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Correct an attendance record (admin only)"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    attendance = await db.attendance.find_one({
        "id": attendance_id,
        "company_id": current_user.company_id
    })
    
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    update_data = {
        "corrected": True,
        "correction_reason": correction.reason,
        "corrected_by": current_user.id,
        "corrected_at": datetime.now(timezone.utc).isoformat()
    }
    
    if correction.clock_in:
        update_data["clock_in"] = correction.clock_in
    if correction.clock_out:
        update_data["clock_out"] = correction.clock_out
    if correction.notes:
        update_data["correction_notes"] = correction.notes
    
    # Recalculate total hours if both times are set
    clock_in = correction.clock_in or attendance.get("clock_in")
    clock_out = correction.clock_out or attendance.get("clock_out")
    
    if clock_in and clock_out:
        clock_in_time = datetime.fromisoformat(clock_in.replace('Z', '+00:00'))
        clock_out_time = datetime.fromisoformat(clock_out.replace('Z', '+00:00'))
        total_hours = round((clock_out_time - clock_in_time).total_seconds() / 3600, 2)
        update_data["total_hours"] = total_hours
    
    await db.attendance.update_one(
        {"id": attendance_id},
        {"$set": update_data}
    )
    
    return {"message": "Attendance corrected successfully"}


@router.get("/attendance/report")
async def get_attendance_report(
    start_date: str,
    end_date: str,
    outlet_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get attendance report for date range"""
    query = {
        "company_id": current_user.company_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }
    
    if outlet_id:
        query["outlet_id"] = outlet_id
    
    records = await db.attendance.find(query, {"_id": 0}).to_list(5000)
    
    # Group by staff
    staff_report = {}
    for record in records:
        staff_id = record["staff_id"]
        if staff_id not in staff_report:
            staff_report[staff_id] = {
                "staff_id": staff_id,
                "staff_name": record["staff_name"],
                "employee_id": record["employee_id"],
                "days_worked": 0,
                "total_hours": 0,
                "late_days": 0,
                "early_departures": 0,
                "overtime_hours": 0
            }
        
        staff_report[staff_id]["days_worked"] += 1
        staff_report[staff_id]["total_hours"] += record.get("total_hours", 0) or 0
        if record.get("is_late"):
            staff_report[staff_id]["late_days"] += 1
        if record.get("early_departure"):
            staff_report[staff_id]["early_departures"] += 1
        staff_report[staff_id]["overtime_hours"] += record.get("overtime_hours", 0) or 0
    
    # Round values
    for report in staff_report.values():
        report["total_hours"] = round(report["total_hours"], 2)
        report["overtime_hours"] = round(report["overtime_hours"], 2)
    
    return {
        "period": {"start_date": start_date, "end_date": end_date},
        "staff_reports": list(staff_report.values()),
        "summary": {
            "total_records": len(records),
            "total_staff": len(staff_report),
            "total_hours": round(sum(r.get("total_hours", 0) or 0 for r in records), 2),
            "total_late_instances": len([r for r in records if r.get("is_late")]),
            "total_overtime": round(sum(r.get("overtime_hours", 0) or 0 for r in records), 2)
        }
    }

