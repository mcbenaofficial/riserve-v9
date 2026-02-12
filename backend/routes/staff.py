from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, date
from bson import ObjectId
import uuid

from .dependencies import get_db, get_current_user, User

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
    db = Depends(get_db)
):
    """Get all staff members"""
    query = {"company_id": current_user.company_id}
    
    if outlet_id:
        query["outlet_id"] = outlet_id
    if department:
        query["department"] = department
    if status:
        query["status"] = status
    if employment_type:
        query["employment_type"] = employment_type
    
    staff = await db.staff.find(query, {"_id": 0}).to_list(500)
    return staff


@router.get("/{staff_id}")
async def get_staff_member(
    staff_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get a single staff member"""
    staff = await db.staff.find_one(
        {"id": staff_id, "company_id": current_user.company_id},
        {"_id": 0}
    )
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return staff


@router.post("")
async def create_staff(
    staff_data: StaffCreate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a new staff member"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    staff_id = str(uuid.uuid4())
    employee_id = staff_data.employee_id or f"EMP-{staff_id[:8].upper()}"
    
    staff_doc = {
        "id": staff_id,
        "user_id": staff_data.user_id,
        "employee_id": employee_id,
        # Personal Info
        "first_name": staff_data.first_name,
        "last_name": staff_data.last_name,
        "full_name": f"{staff_data.first_name} {staff_data.last_name}",
        "email": staff_data.email,
        "phone": staff_data.phone or "",
        "date_of_birth": staff_data.date_of_birth,
        "gender": staff_data.gender,
        "address": staff_data.address,
        "city": staff_data.city,
        "state": staff_data.state,
        "postal_code": staff_data.postal_code,
        # Emergency Contact
        "emergency_contact": {
            "name": staff_data.emergency_contact_name,
            "phone": staff_data.emergency_contact_phone,
            "relation": staff_data.emergency_contact_relation
        },
        # Employment Info
        "department": staff_data.department,
        "designation": staff_data.designation,
        "employment_type": staff_data.employment_type,
        "join_date": staff_data.join_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "outlet_id": staff_data.outlet_id,
        "hourly_rate": staff_data.hourly_rate,
        "monthly_salary": staff_data.monthly_salary,
        # Skills
        "skills": staff_data.skills,
        "certifications": staff_data.certifications,
        # Meta
        "status": "active",
        "company_id": current_user.company_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id
    }
    
    await db.staff.insert_one(staff_doc)
    
    # Initialize leave balances for this staff member
    await initialize_leave_balances(db, staff_id, current_user.company_id)
    
    return {"id": staff_id, "employee_id": employee_id, "message": "Staff member created"}


@router.put("/{staff_id}")
async def update_staff(
    staff_id: str,
    staff_data: StaffUpdate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update a staff member"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    staff = await db.staff.find_one(
        {"id": staff_id, "company_id": current_user.company_id}
    )
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    update_data = {k: v for k, v in staff_data.dict().items() if v is not None}
    
    if "first_name" in update_data or "last_name" in update_data:
        first_name = update_data.get("first_name", staff["first_name"])
        last_name = update_data.get("last_name", staff["last_name"])
        update_data["full_name"] = f"{first_name} {last_name}"
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.staff.update_one(
        {"id": staff_id},
        {"$set": update_data}
    )
    
    return {"message": "Staff member updated"}


@router.delete("/{staff_id}")
async def delete_staff(
    staff_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Soft delete a staff member"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.staff.update_one(
        {"id": staff_id, "company_id": current_user.company_id},
        {"$set": {"status": "inactive", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    return {"message": "Staff member deactivated"}


# ============== LEAVE POLICY ROUTES ==============

@router.get("/leave/policies")
async def get_leave_policies(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get all leave policies"""
    policies = await db.leave_policies.find(
        {"company_id": current_user.company_id, "active": {"$ne": False}},
        {"_id": 0}
    ).to_list(50)
    return policies


@router.post("/leave/policies")
async def create_leave_policy(
    policy: LeavePolicyCreate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a new leave policy"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    policy_id = str(uuid.uuid4())
    
    policy_doc = {
        "id": policy_id,
        "name": policy.name,
        "code": policy.code.upper(),
        "description": policy.description,
        "days_per_year": policy.days_per_year,
        "accrual_type": policy.accrual_type,
        "carry_forward": policy.carry_forward,
        "max_carry_forward_days": policy.max_carry_forward_days,
        "requires_approval": policy.requires_approval,
        "min_notice_days": policy.min_notice_days,
        "max_consecutive_days": policy.max_consecutive_days,
        "applicable_to": policy.applicable_to,
        "paid": policy.paid,
        "active": True,
        "company_id": current_user.company_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.leave_policies.insert_one(policy_doc)
    return {"id": policy_id, "message": "Leave policy created"}


@router.put("/leave/policies/{policy_id}")
async def update_leave_policy(
    policy_id: str,
    policy_data: LeavePolicyUpdate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update a leave policy"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in policy_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.leave_policies.update_one(
        {"id": policy_id, "company_id": current_user.company_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Leave policy not found")
    
    return {"message": "Leave policy updated"}


@router.delete("/leave/policies/{policy_id}")
async def delete_leave_policy(
    policy_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Soft delete a leave policy"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.leave_policies.update_one(
        {"id": policy_id, "company_id": current_user.company_id},
        {"$set": {"active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Leave policy not found")
    
    return {"message": "Leave policy deleted"}


# ============== LEAVE REQUEST ROUTES ==============

@router.get("/leave/requests")
async def get_leave_requests(
    staff_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get leave requests"""
    query = {"company_id": current_user.company_id}
    
    if staff_id:
        query["staff_id"] = staff_id
    if status:
        query["status"] = status
    if start_date:
        query["start_date"] = {"$gte": start_date}
    if end_date:
        query["end_date"] = {"$lte": end_date}
    
    requests = await db.leave_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return requests


@router.post("/leave/requests")
async def create_leave_request(
    request_data: LeaveRequestCreate,
    staff_id: str,  # Staff member requesting leave
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a leave request"""
    # Get leave policy
    policy = await db.leave_policies.find_one(
        {"id": request_data.leave_type_id, "company_id": current_user.company_id}
    )
    if not policy:
        raise HTTPException(status_code=404, detail="Leave policy not found")
    
    # Get staff member
    staff = await db.staff.find_one(
        {"id": staff_id, "company_id": current_user.company_id}
    )
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    # Calculate days
    start = datetime.fromisoformat(request_data.start_date)
    end = datetime.fromisoformat(request_data.end_date)
    days = (end - start).days + 1
    if request_data.half_day:
        days = 0.5
    
    # Check balance
    balance = await get_leave_balance(db, staff_id, request_data.leave_type_id, current_user.company_id)
    if balance < days:
        raise HTTPException(status_code=400, detail=f"Insufficient leave balance. Available: {balance} days")
    
    request_id = str(uuid.uuid4())
    
    leave_request = {
        "id": request_id,
        "staff_id": staff_id,
        "staff_name": staff["full_name"],
        "leave_type_id": request_data.leave_type_id,
        "leave_type_name": policy["name"],
        "start_date": request_data.start_date,
        "end_date": request_data.end_date,
        "days": days,
        "half_day": request_data.half_day,
        "half_day_type": request_data.half_day_type,
        "reason": request_data.reason,
        "status": "pending" if policy["requires_approval"] else "approved",
        "approver_id": None,
        "approver_notes": None,
        "approved_at": None if policy["requires_approval"] else datetime.now(timezone.utc).isoformat(),
        "company_id": current_user.company_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id
    }
    
    await db.leave_requests.insert_one(leave_request)
    
    # Deduct from balance if auto-approved
    if not policy["requires_approval"]:
        await deduct_leave_balance(db, staff_id, request_data.leave_type_id, days, current_user.company_id)
    
    return {"id": request_id, "status": leave_request["status"], "message": "Leave request created"}


@router.put("/leave/requests/{request_id}")
async def update_leave_request(
    request_id: str,
    update_data: LeaveRequestUpdate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Approve/Reject a leave request"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    leave_request = await db.leave_requests.find_one(
        {"id": request_id, "company_id": current_user.company_id}
    )
    if not leave_request:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    if leave_request["status"] != "pending":
        raise HTTPException(status_code=400, detail="Leave request already processed")
    
    update_doc = {
        "status": update_data.status,
        "approver_id": current_user.id,
        "approver_notes": update_data.approver_notes,
        "approved_at": datetime.now(timezone.utc).isoformat() if update_data.status == "approved" else None,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.leave_requests.update_one(
        {"id": request_id},
        {"$set": update_doc}
    )
    
    # Deduct balance if approved
    if update_data.status == "approved":
        await deduct_leave_balance(
            db, 
            leave_request["staff_id"], 
            leave_request["leave_type_id"], 
            leave_request["days"],
            current_user.company_id
        )
    
    return {"message": f"Leave request {update_data.status}"}


@router.get("/leave/balances/{staff_id}")
async def get_staff_leave_balances(
    staff_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get leave balances for a staff member"""
    balances = await db.leave_balances.find(
        {"staff_id": staff_id, "company_id": current_user.company_id},
        {"_id": 0}
    ).to_list(50)
    return balances


# ============== SHIFT TEMPLATE ROUTES ==============

@router.get("/shifts/templates")
async def get_shift_templates(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get all shift templates"""
    templates = await db.shift_templates.find(
        {"company_id": current_user.company_id, "active": {"$ne": False}},
        {"_id": 0}
    ).to_list(50)
    return templates


@router.post("/shifts/templates")
async def create_shift_template(
    template: ShiftTemplateCreate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a new shift template"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    template_id = str(uuid.uuid4())
    
    template_doc = {
        "id": template_id,
        "name": template.name,
        "code": template.code.upper(),
        "start_time": template.start_time,
        "end_time": template.end_time,
        "break_duration_minutes": template.break_duration_minutes,
        "color": template.color,
        "applicable_days": template.applicable_days,
        "active": True,
        "company_id": current_user.company_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.shift_templates.insert_one(template_doc)
    return {"id": template_id, "message": "Shift template created"}


@router.put("/shifts/templates/{template_id}")
async def update_shift_template(
    template_id: str,
    template_data: ShiftTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update a shift template"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in template_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.shift_templates.update_one(
        {"id": template_id, "company_id": current_user.company_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Shift template not found")
    
    return {"message": "Shift template updated"}


@router.delete("/shifts/templates/{template_id}")
async def delete_shift_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Soft delete a shift template"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.shift_templates.update_one(
        {"id": template_id, "company_id": current_user.company_id},
        {"$set": {"active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Shift template not found")
    
    return {"message": "Shift template deleted"}


# ============== STAFF SCHEDULE ROUTES ==============

@router.get("/schedules")
async def get_staff_schedules(
    start_date: str,
    end_date: str,
    staff_id: Optional[str] = None,
    outlet_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get staff schedules for a date range"""
    query = {
        "company_id": current_user.company_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }
    
    if staff_id:
        query["staff_id"] = staff_id
    if outlet_id:
        query["outlet_id"] = outlet_id
    
    schedules = await db.staff_schedules.find(query, {"_id": 0}).to_list(500)
    return schedules


@router.post("/schedules")
async def create_staff_schedule(
    schedule: StaffScheduleCreate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Assign a shift to a staff member"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check for existing schedule
    existing = await db.staff_schedules.find_one({
        "staff_id": schedule.staff_id,
        "date": schedule.date,
        "company_id": current_user.company_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Staff already has a schedule for this date")
    
    # Get staff and shift info
    staff = await db.staff.find_one({"id": schedule.staff_id})
    shift = await db.shift_templates.find_one({"id": schedule.shift_template_id})
    
    if not staff or not shift:
        raise HTTPException(status_code=404, detail="Staff or shift template not found")
    
    schedule_id = str(uuid.uuid4())
    
    schedule_doc = {
        "id": schedule_id,
        "staff_id": schedule.staff_id,
        "staff_name": staff["full_name"],
        "shift_template_id": schedule.shift_template_id,
        "shift_name": shift["name"],
        "shift_start": shift["start_time"],
        "shift_end": shift["end_time"],
        "shift_color": shift["color"],
        "date": schedule.date,
        "outlet_id": schedule.outlet_id or staff.get("outlet_id"),
        "notes": schedule.notes,
        "status": "scheduled",
        "company_id": current_user.company_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.staff_schedules.insert_one(schedule_doc)
    return {"id": schedule_id, "message": "Schedule created"}


@router.post("/schedules/bulk")
async def create_bulk_schedules(
    schedules: List[StaffScheduleCreate],
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Bulk create schedules"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    created = 0
    skipped = 0
    
    for schedule in schedules:
        existing = await db.staff_schedules.find_one({
            "staff_id": schedule.staff_id,
            "date": schedule.date,
            "company_id": current_user.company_id
        })
        
        if existing:
            skipped += 1
            continue
        
        staff = await db.staff.find_one({"id": schedule.staff_id})
        shift = await db.shift_templates.find_one({"id": schedule.shift_template_id})
        
        if not staff or not shift:
            skipped += 1
            continue
        
        schedule_doc = {
            "id": str(uuid.uuid4()),
            "staff_id": schedule.staff_id,
            "staff_name": staff["full_name"],
            "shift_template_id": schedule.shift_template_id,
            "shift_name": shift["name"],
            "shift_start": shift["start_time"],
            "shift_end": shift["end_time"],
            "shift_color": shift["color"],
            "date": schedule.date,
            "outlet_id": schedule.outlet_id or staff.get("outlet_id"),
            "notes": schedule.notes,
            "status": "scheduled",
            "company_id": current_user.company_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.staff_schedules.insert_one(schedule_doc)
        created += 1
    
    return {"created": created, "skipped": skipped}


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a schedule"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.staff_schedules.delete_one(
        {"id": schedule_id, "company_id": current_user.company_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    return {"message": "Schedule deleted"}


# ============== HOLIDAY ROUTES ==============

@router.get("/holidays")
async def get_holidays(
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get all holidays"""
    query = {"company_id": current_user.company_id, "active": {"$ne": False}}
    
    if year:
        query["date"] = {"$regex": f"^{year}"}
    
    holidays = await db.holidays.find(query, {"_id": 0}).sort("date", 1).to_list(100)
    return holidays


@router.post("/holidays")
async def create_holiday(
    holiday: HolidayCreate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a new holiday"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    holiday_id = str(uuid.uuid4())
    
    holiday_doc = {
        "id": holiday_id,
        "name": holiday.name,
        "date": holiday.date,
        "recurring": holiday.recurring,
        "holiday_type": holiday.holiday_type,
        "applicable_to": holiday.applicable_to,
        "active": True,
        "company_id": current_user.company_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.holidays.insert_one(holiday_doc)
    return {"id": holiday_id, "message": "Holiday created"}


@router.put("/holidays/{holiday_id}")
async def update_holiday(
    holiday_id: str,
    holiday_data: HolidayUpdate,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update a holiday"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in holiday_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.holidays.update_one(
        {"id": holiday_id, "company_id": current_user.company_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    return {"message": "Holiday updated"}


@router.delete("/holidays/{holiday_id}")
async def delete_holiday(
    holiday_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Soft delete a holiday"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.holidays.update_one(
        {"id": holiday_id, "company_id": current_user.company_id},
        {"$set": {"active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    return {"message": "Holiday deleted"}


# ============== HELPER FUNCTIONS ==============

async def initialize_leave_balances(db, staff_id: str, company_id: str):
    """Initialize leave balances for a new staff member"""
    policies = await db.leave_policies.find(
        {"company_id": company_id, "active": {"$ne": False}}
    ).to_list(50)
    
    current_year = datetime.now().year
    
    for policy in policies:
        balance_doc = {
            "id": str(uuid.uuid4()),
            "staff_id": staff_id,
            "leave_type_id": policy["id"],
            "leave_type_name": policy["name"],
            "year": current_year,
            "entitled": policy["days_per_year"],
            "used": 0,
            "balance": policy["days_per_year"],
            "carry_forward": 0,
            "company_id": company_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.leave_balances.insert_one(balance_doc)


async def get_leave_balance(db, staff_id: str, leave_type_id: str, company_id: str) -> float:
    """Get current leave balance"""
    current_year = datetime.now().year
    balance = await db.leave_balances.find_one({
        "staff_id": staff_id,
        "leave_type_id": leave_type_id,
        "year": current_year,
        "company_id": company_id
    })
    return balance["balance"] if balance else 0


async def deduct_leave_balance(db, staff_id: str, leave_type_id: str, days: float, company_id: str):
    """Deduct leave from balance"""
    current_year = datetime.now().year
    await db.leave_balances.update_one(
        {
            "staff_id": staff_id,
            "leave_type_id": leave_type_id,
            "year": current_year,
            "company_id": company_id
        },
        {
            "$inc": {"used": days, "balance": -days},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )


# ============== STATS ROUTE ==============

@router.get("/stats/overview")
async def get_staff_stats(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get staff management overview stats"""
    company_id = current_user.company_id
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Staff counts
    total_staff = await db.staff.count_documents({"company_id": company_id, "status": "active"})
    
    # Today's schedules
    today_schedules = await db.staff_schedules.count_documents({
        "company_id": company_id,
        "date": today
    })
    
    # Pending leave requests
    pending_leaves = await db.leave_requests.count_documents({
        "company_id": company_id,
        "status": "pending"
    })
    
    # On leave today
    on_leave_today = await db.leave_requests.count_documents({
        "company_id": company_id,
        "status": "approved",
        "start_date": {"$lte": today},
        "end_date": {"$gte": today}
    })
    
    # Upcoming holidays (next 30 days)
    from_date = today
    to_date = (datetime.now() + __import__('datetime').timedelta(days=30)).strftime("%Y-%m-%d")
    upcoming_holidays = await db.holidays.count_documents({
        "company_id": company_id,
        "active": {"$ne": False},
        "date": {"$gte": from_date, "$lte": to_date}
    })
    
    # Attendance stats
    clocked_in_today = await db.attendance.count_documents({
        "company_id": company_id,
        "date": today
    })
    currently_working = await db.attendance.count_documents({
        "company_id": company_id,
        "date": today,
        "clock_out": None
    })
    late_today = await db.attendance.count_documents({
        "company_id": company_id,
        "date": today,
        "is_late": True
    })
    
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
    db = Depends(get_db)
):
    """Clock in a staff member"""
    # Get staff member
    staff = await db.staff.find_one(
        {"id": data.staff_id, "company_id": current_user.company_id}
    )
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check if already clocked in today
    existing = await db.attendance.find_one({
        "staff_id": data.staff_id,
        "date": today,
        "clock_out": None
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already clocked in")
    
    attendance_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Get scheduled shift for today
    schedule = await db.staff_schedules.find_one({
        "staff_id": data.staff_id,
        "date": today,
        "company_id": current_user.company_id
    })
    
    scheduled_start = schedule.get("shift_start") if schedule else None
    is_late = False
    late_minutes = 0
    
    if scheduled_start:
        scheduled_time = datetime.strptime(f"{today} {scheduled_start}", "%Y-%m-%d %H:%M")
        scheduled_time = scheduled_time.replace(tzinfo=timezone.utc)
        if now > scheduled_time:
            is_late = True
            late_minutes = int((now - scheduled_time).total_seconds() / 60)
    
    attendance_doc = {
        "id": attendance_id,
        "staff_id": data.staff_id,
        "staff_name": staff["full_name"],
        "employee_id": staff["employee_id"],
        "date": today,
        "clock_in": now.isoformat(),
        "clock_out": None,
        "outlet_id": data.outlet_id or staff.get("outlet_id"),
        "scheduled_start": scheduled_start,
        "scheduled_end": schedule.get("shift_end") if schedule else None,
        "is_late": is_late,
        "late_minutes": late_minutes,
        "early_departure": False,
        "early_departure_minutes": 0,
        "total_hours": None,
        "overtime_hours": 0,
        "break_minutes": 0,
        "status": "present",
        "notes": data.notes,
        "location": data.location,
        "company_id": current_user.company_id,
        "created_at": now.isoformat()
    }
    
    await db.attendance.insert_one(attendance_doc)
    
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
    db = Depends(get_db)
):
    """Clock out a staff member"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Find today's clock-in record
    attendance = await db.attendance.find_one({
        "staff_id": data.staff_id,
        "date": today,
        "clock_out": None,
        "company_id": current_user.company_id
    })
    
    if not attendance:
        raise HTTPException(status_code=400, detail="No active clock-in found for today")
    
    now = datetime.now(timezone.utc)
    clock_in_time = datetime.fromisoformat(attendance["clock_in"].replace('Z', '+00:00'))
    
    # Calculate total hours
    total_seconds = (now - clock_in_time).total_seconds()
    total_hours = round(total_seconds / 3600, 2)
    
    # Check early departure
    early_departure = False
    early_departure_minutes = 0
    scheduled_end = attendance.get("scheduled_end")
    
    if scheduled_end:
        scheduled_end_time = datetime.strptime(f"{today} {scheduled_end}", "%Y-%m-%d %H:%M")
        scheduled_end_time = scheduled_end_time.replace(tzinfo=timezone.utc)
        if now < scheduled_end_time:
            early_departure = True
            early_departure_minutes = int((scheduled_end_time - now).total_seconds() / 60)
    
    # Calculate overtime (if worked more than scheduled)
    overtime_hours = 0
    if scheduled_end and attendance.get("scheduled_start"):
        scheduled_start_time = datetime.strptime(f"{today} {attendance['scheduled_start']}", "%Y-%m-%d %H:%M")
        scheduled_end_time = datetime.strptime(f"{today} {scheduled_end}", "%Y-%m-%d %H:%M")
        scheduled_hours = (scheduled_end_time - scheduled_start_time).total_seconds() / 3600
        if total_hours > scheduled_hours:
            overtime_hours = round(total_hours - scheduled_hours, 2)
    
    update_data = {
        "clock_out": now.isoformat(),
        "total_hours": total_hours,
        "early_departure": early_departure,
        "early_departure_minutes": early_departure_minutes,
        "overtime_hours": overtime_hours,
        "updated_at": now.isoformat()
    }
    
    if data.notes:
        update_data["clock_out_notes"] = data.notes
    if data.location:
        update_data["clock_out_location"] = data.location
    
    await db.attendance.update_one(
        {"id": attendance["id"]},
        {"$set": update_data}
    )
    
    return {
        "id": attendance["id"],
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
    db = Depends(get_db)
):
    """Get attendance records"""
    query = {"company_id": current_user.company_id}
    
    if staff_id:
        query["staff_id"] = staff_id
    if date:
        query["date"] = date
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    if status:
        query["status"] = status
    
    records = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    return records


@router.get("/attendance/today")
async def get_today_attendance(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get today's attendance status for all staff"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get all active staff
    staff_list = await db.staff.find(
        {"company_id": current_user.company_id, "status": "active"},
        {"_id": 0, "id": 1, "full_name": 1, "employee_id": 1, "designation": 1, "outlet_id": 1}
    ).to_list(500)
    
    # Get today's attendance records
    attendance_records = await db.attendance.find(
        {"company_id": current_user.company_id, "date": today},
        {"_id": 0}
    ).to_list(500)
    
    # Get today's approved leaves
    on_leave = await db.leave_requests.find(
        {
            "company_id": current_user.company_id,
            "status": "approved",
            "start_date": {"$lte": today},
            "end_date": {"$gte": today}
        },
        {"_id": 0, "staff_id": 1}
    ).to_list(100)
    on_leave_ids = [l["staff_id"] for l in on_leave]
    
    # Build attendance map
    attendance_map = {a["staff_id"]: a for a in attendance_records}
    
    result = []
    for staff in staff_list:
        staff_id = staff["id"]
        attendance = attendance_map.get(staff_id)
        
        status = "absent"
        if staff_id in on_leave_ids:
            status = "on_leave"
        elif attendance:
            if attendance.get("clock_out"):
                status = "completed"
            else:
                status = "working"
        
        result.append({
            **staff,
            "status": status,
            "clock_in": attendance.get("clock_in") if attendance else None,
            "clock_out": attendance.get("clock_out") if attendance else None,
            "is_late": attendance.get("is_late", False) if attendance else False,
            "late_minutes": attendance.get("late_minutes", 0) if attendance else 0,
            "total_hours": attendance.get("total_hours") if attendance else None
        })
    
    # Summary stats
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
    db = Depends(get_db)
):
    """Get attendance history for a specific staff member"""
    now = datetime.now()
    month = month or now.month
    year = year or now.year
    
    # Calculate date range for the month
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    
    records = await db.attendance.find(
        {
            "staff_id": staff_id,
            "company_id": current_user.company_id,
            "date": {"$gte": start_date, "$lt": end_date}
        },
        {"_id": 0}
    ).sort("date", 1).to_list(31)
    
    # Calculate monthly stats
    total_days = len(records)
    total_hours = sum(r.get("total_hours", 0) or 0 for r in records)
    late_days = len([r for r in records if r.get("is_late")])
    early_departures = len([r for r in records if r.get("early_departure")])
    overtime_hours = sum(r.get("overtime_hours", 0) or 0 for r in records)
    
    return {
        "records": records,
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

