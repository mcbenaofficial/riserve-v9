from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from .dependencies import services_collection, get_current_user, User

router = APIRouter(prefix="/services", tags=["Services"])


class ServiceBase(BaseModel):
    name: str
    duration_min: int = 30
    price: int = 299
    description: Optional[str] = None


class ServiceCreate(ServiceBase):
    pass


@router.get("")
async def get_services(current_user: User = Depends(get_current_user)):
    # Filter by company_id for data isolation
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    services = await services_collection.find(query, {"_id": 0}).to_list(1000)
    return services


@router.post("")
async def create_service(service_input: ServiceCreate, current_user: User = Depends(get_current_user)):
    service_doc = {
        "id": str(uuid.uuid4()),
        "company_id": current_user.company_id,  # Associate with company
        "name": service_input.name,
        "duration_min": service_input.duration_min,
        "price": service_input.price,
        "description": service_input.description,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await services_collection.insert_one(service_doc)
    service_doc.pop("_id", None)
    return service_doc


@router.put("/{service_id}")
async def update_service(service_id: str, service_input: ServiceCreate, current_user: User = Depends(get_current_user)):
    # Ensure user can only update their own company's services
    query = {"id": service_id}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    result = await services_collection.update_one(
        query,
        {"$set": {
            "name": service_input.name,
            "duration_min": service_input.duration_min,
            "price": service_input.price,
            "description": service_input.description
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    
    service = await services_collection.find_one({"id": service_id}, {"_id": 0})
    return service


@router.delete("/{service_id}")
async def delete_service(service_id: str, current_user: User = Depends(get_current_user)):
    # Ensure user can only delete their own company's services
    query = {"id": service_id}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    result = await services_collection.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"message": "Service deleted"}
