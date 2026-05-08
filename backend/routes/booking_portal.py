"""
AI-Powered Booking Portal — public-facing chat + booking endpoints.

GET  /api/public/booking-portal/{outlet_id}          → portal metadata
POST /api/public/booking-portal/chat/{outlet_id}     → SSE agentic stream (AG-UI events)
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, date as date_type
import uuid
import json
import os
import logging

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

import models_pg
from .dependencies import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/public/booking-portal", tags=["booking-portal"])

# In-memory image cache: service_name → generated image URL
_service_image_cache: dict[str, str] = {}

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
_CHAT_MODEL = "google/gemma-4-26b-a4b-it"
_VISION_MODEL = "meta-llama/llama-3.2-11b-vision-instruct:free"
_IMAGE_MODEL = "black-forest-labs/flux-schnell"
_OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
_OPENROUTER_IMAGE_URL = "https://openrouter.ai/api/v1/images/generations"

_HEADERS = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
    "HTTP-Referer": "https://riserve.app",
    "X-Title": "Riserve",
}


# ═══════════════════════════════════════════════
# Pydantic Schemas
# ═══════════════════════════════════════════════

class ChatMessage(BaseModel):
    role: str
    content: Any


class ChatIdentity(BaseModel):
    name: str = ""
    phone: str = ""


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    identity: Optional[ChatIdentity] = None
    image_base64: Optional[str] = None


# ═══════════════════════════════════════════════
# Tool definitions (OpenAI function-calling format)
# ═══════════════════════════════════════════════

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_available_slots",
            "description": "Get available time slots for a specific date and optional service.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format"
                    },
                    "service_id": {
                        "type": "string",
                        "description": "Optional service ID to determine duration"
                    },
                    "duration_minutes": {
                        "type": "integer",
                        "description": "Duration in minutes (used if service_id not provided)"
                    }
                },
                "required": ["date"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_booking",
            "description": "Create a new booking for the customer. Always confirm details with the customer before calling this.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format"
                    },
                    "time": {
                        "type": "string",
                        "description": "Time in HH:MM 24-hour format"
                    },
                    "service_id": {
                        "type": "string",
                        "description": "Service ID to book"
                    },
                    "notes": {
                        "type": "string",
                        "description": "Optional notes for the booking"
                    }
                },
                "required": ["date", "time", "service_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_bookings",
            "description": "Retrieve the customer's recent bookings at this outlet.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "reschedule_booking",
            "description": "Reschedule an existing booking to a new date and time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_id": {
                        "type": "string",
                        "description": "ID of the booking to reschedule"
                    },
                    "new_date": {
                        "type": "string",
                        "description": "New date in YYYY-MM-DD format"
                    },
                    "new_time": {
                        "type": "string",
                        "description": "New time in HH:MM 24-hour format"
                    }
                },
                "required": ["booking_id", "new_date", "new_time"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_booking",
            "description": "Cancel an existing booking.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_id": {
                        "type": "string",
                        "description": "ID of the booking to cancel"
                    }
                },
                "required": ["booking_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_hairstyles",
            "description": "Get AI-powered hairstyle suggestions based on preferences and face shape.",
            "parameters": {
                "type": "object",
                "properties": {
                    "preferences": {
                        "type": "string",
                        "description": "Customer's style preferences or desired look"
                    },
                    "face_shape": {
                        "type": "string",
                        "description": "Customer's face shape (oval, round, square, heart, oblong, etc.)"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_hairstyle_image",
            "description": "Generate a portrait preview image showing a specific hairstyle.",
            "parameters": {
                "type": "object",
                "properties": {
                    "hairstyle": {
                        "type": "string",
                        "description": "Name or description of the hairstyle to visualize"
                    },
                    "face_description": {
                        "type": "string",
                        "description": "Description of the person's face and features"
                    },
                    "beard_style": {
                        "type": "string",
                        "description": "Optional beard style to include in the image"
                    }
                },
                "required": ["hairstyle", "face_description"]
            }
        }
    }
]


# ═══════════════════════════════════════════════
# GET /api/public/booking-portal/service-image
# ═══════════════════════════════════════════════

def _service_image_prompt(service_name: str) -> str:
    n = service_name.lower()
    base = "professional salon photography, realistic, high quality, luxury salon, soft warm lighting, "
    if any(k in n for k in ["makeup", "bridal"]):
        return base + f"elegant {service_name} result on a model, flawless professional makeup, glamorous"
    if any(k in n for k in ["manicure", "pedicure", "nail"]):
        return base + f"closeup of beautifully done {service_name}, intricate nail art, clean well-groomed hands"
    if any(k in n for k in ["facial", "clean", "hydra"]):
        return base + f"glowing radiant skin after {service_name} treatment, luxury spa atmosphere"
    if any(k in n for k in ["colour", "color", "highlight", "balayage", "root"]):
        return base + f"vibrant beautiful hair color result, {service_name}, glossy healthy hair, salon model"
    if any(k in n for k in ["keratin", "smooth"]):
        return base + f"silky straight smooth hair after {service_name} treatment, mirror shine, glossy finish"
    if "spa" in n:
        return base + f"lustrous healthy bouncy hair after {service_name}, nourished hair close-up"
    return base + f"{service_name} result on a professional model, clean modern style, salon quality"


@router.get("/service-image")
async def get_service_image(service_name: str):
    """Generate (and cache) an AI preview image for a named service."""
    cache_key = service_name.lower().strip()
    if cache_key in _service_image_cache:
        return {"url": _service_image_cache[cache_key]}

    if not OPENROUTER_API_KEY:
        return {"url": None}

    prompt = _service_image_prompt(service_name)
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                _OPENROUTER_IMAGE_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={"model": _IMAGE_MODEL, "prompt": prompt, "n": 1, "size": "512x512"},
            )
        data = resp.json()
        entry = (data.get("data") or [{}])[0]
        url = entry.get("url") or entry.get("b64_json")
        if url:
            _service_image_cache[cache_key] = url
        return {"url": url}
    except Exception as e:
        logger.warning(f"Service image generation failed for '{service_name}': {e}")
        return {"url": None}


# ═══════════════════════════════════════════════
# GET /api/public/booking-portal/{outlet_id}
# ═══════════════════════════════════════════════

@router.get("/{outlet_id}")
async def get_booking_portal(outlet_id: str, db: AsyncSession = Depends(get_db)):
    """Return portal metadata: outlet branding, services, slot config, and resources."""

    outlet = (await db.execute(
        select(models_pg.Outlet).where(models_pg.Outlet.id == outlet_id)
    )).scalar_one_or_none()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")

    company = (await db.execute(
        select(models_pg.Company).where(models_pg.Company.id == outlet.company_id)
    )).scalar_one_or_none()

    services = (await db.execute(
        select(models_pg.Service)
        .options(selectinload(models_pg.Service.category))
        .where(
            models_pg.Service.company_id == outlet.company_id,
            models_pg.Service.active == True,
        ).order_by(models_pg.Service.name)
    )).scalars().all()

    slot_config_rec = (await db.execute(
        select(models_pg.SlotConfig).where(models_pg.SlotConfig.outlet_id == outlet_id)
    )).scalar_one_or_none()

    resources = (await db.execute(
        select(models_pg.Resource).where(
            models_pg.Resource.outlet_id == outlet_id,
            models_pg.Resource.active == True,
        ).order_by(models_pg.Resource.name)
    )).scalars().all()

    return {
        "outlet": {
            "id": outlet.id,
            "name": outlet.name,
            "location": outlet.location,
            "contact_phone": outlet.contact_phone,
            "portal_logo_url": getattr(outlet, "portal_logo_url", None),
            "portal_color_scheme": outlet.portal_color_scheme or {},
        },
        "company": {
            "name": company.name if company else "",
        },
        "services": [
            {
                "id": str(s.id),
                "name": s.name,
                "price": float(s.price or 0),
                "duration": s.duration or 30,
                "description": s.description or "",
                "category_name": s.category.name if s.category else None,
            }
            for s in services
        ],
        "slot_config": slot_config_rec.configuration if slot_config_rec else {},
        "resources": [{"id": r.id, "name": r.name} for r in resources],
    }


# ═══════════════════════════════════════════════
# POST /api/public/booking-portal/chat/{outlet_id}
# ═══════════════════════════════════════════════

@router.post("/chat/{outlet_id}")
async def booking_portal_chat(
    outlet_id: str,
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """AG-UI SSE streaming endpoint — agentic booking portal."""

    # ── Load outlet + context data ──────────────────────────────────────────
    outlet = (await db.execute(
        select(models_pg.Outlet).where(models_pg.Outlet.id == outlet_id)
    )).scalar_one_or_none()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")

    services = (await db.execute(
        select(models_pg.Service).where(
            models_pg.Service.company_id == outlet.company_id,
            models_pg.Service.active == True,
        ).order_by(models_pg.Service.name)
    )).scalars().all()

    slot_config_rec = (await db.execute(
        select(models_pg.SlotConfig).where(models_pg.SlotConfig.outlet_id == outlet_id)
    )).scalar_one_or_none()
    slot_rules = slot_config_rec.configuration if slot_config_rec else {}

    identity = req.identity or ChatIdentity()
    today_str = datetime.now().strftime("%Y-%m-%d")

    services_text = "\n".join(
        f"  - {s.name} (ID: {s.id}, price: ₹{float(s.price or 0):.0f}, duration: {s.duration or 30} min)"
        for s in services
    )

    system_prompt = f"""You are a helpful booking assistant for {outlet.name}.

Today's date: {today_str}
Customer name: {identity.name or "Guest"}
Customer phone: {identity.phone or "not provided"}

Available services:
{services_text or "  (No services configured)"}

You can help the customer:
- Check available appointment slots for any date
- Create new bookings (always confirm date, time, and service with the customer before booking)
- View their existing bookings
- Reschedule or cancel bookings
- Get personalised hairstyle suggestions based on their face shape and preferences
- Generate a preview image showing what a hairstyle would look like

When a requested slot is taken, proactively suggest the next 2–3 available times.
Always confirm booking details (date, time, service name, price) before calling create_booking.
Be warm, concise, and helpful."""

    # ── Generator ────────────────────────────────────────────────────────────
    async def event_stream():
        # ── Optional: analyse uploaded face image ───────────────────────────
        face_description: Optional[str] = None
        if req.image_base64:
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    vision_resp = await client.post(
                        _OPENROUTER_CHAT_URL,
                        headers=_HEADERS,
                        json={
                            "model": _VISION_MODEL,
                            "messages": [
                                {
                                    "role": "user",
                                    "content": [
                                        {
                                            "type": "image_url",
                                            "image_url": {"url": req.image_base64},
                                        },
                                        {
                                            "type": "text",
                                            "text": (
                                                "Describe this person's face in detail for use in a hairstyle preview. "
                                                "Include face shape, skin tone, hair texture, and any notable features. "
                                                "Be concise (2-3 sentences). Do not include names or identity information."
                                            ),
                                        },
                                    ],
                                }
                            ],
                        },
                    )
                if vision_resp.status_code == 200:
                    face_description = (
                        vision_resp.json()
                        .get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", "")
                        .strip()
                    )
            except Exception as exc:
                logger.warning(f"Vision analysis failed: {exc}")

        # ── Helper: emit SSE event ───────────────────────────────────────────
        def sse(payload: dict) -> str:
            return f"data: {json.dumps(payload)}\n\n"

        # ── Tool executor ────────────────────────────────────────────────────
        async def execute_tool(name: str, args: dict) -> dict:

            # ── get_available_slots ──────────────────────────────────────────
            if name == "get_available_slots":
                raw_date = args.get("date", today_str)
                try:
                    book_date = date_type.fromisoformat(raw_date)
                except ValueError:
                    return {"error": f"Invalid date: {raw_date}"}

                service_id = args.get("service_id")
                duration = args.get("duration_minutes", 30)

                if service_id:
                    svc = (await db.execute(
                        select(models_pg.Service).where(models_pg.Service.id == service_id)
                    )).scalar_one_or_none()
                    if svc:
                        duration = svc.duration or 30

                slot_step = slot_rules.get("slot_duration_min", 30)
                if slot_step <= 0:
                    slot_step = 30
                buffer_time = slot_rules.get("buffer_time_minutes", 0)

                def t_to_mins(t: str) -> int:
                    try:
                        h, m = map(int, t.split(":"))
                        return h * 60 + m
                    except Exception:
                        return 0

                op_start = t_to_mins(slot_rules.get("operating_hours_start", "09:00"))
                op_end = t_to_mins(slot_rules.get("operating_hours_end", "18:00"))

                existing_bookings = (await db.execute(
                    select(models_pg.Booking).where(
                        models_pg.Booking.outlet_id == outlet_id,
                        models_pg.Booking.date == book_date,
                        models_pg.Booking.status.not_in(["Cancelled", "Declined"]),
                    )
                )).scalars().all()

                blocked: list = []
                for b in existing_bookings:
                    if not b.time:
                        continue
                    s = t_to_mins(b.time)
                    e = s + (b.duration or slot_step) + buffer_time
                    blocked.append((s, e))

                for brk in slot_rules.get("breaks", []) or []:
                    bs = t_to_mins(brk.get("start", ""))
                    be = t_to_mins(brk.get("end", ""))
                    if be > bs:
                        blocked.append((bs, be))

                now_mins: Optional[int] = None
                if book_date == datetime.now().date():
                    n = datetime.now()
                    now_mins = n.hour * 60 + n.minute

                slots = []
                cursor = op_start
                while cursor + duration <= op_end:
                    end = cursor + duration + buffer_time
                    is_free = not any(cursor < be and end > bs for bs, be in blocked)
                    is_future = now_mins is None or cursor > now_mins
                    if is_free and is_future:
                        h, m = divmod(cursor, 60)
                        value = f"{h:02d}:{m:02d}"
                        label = datetime(2000, 1, 1, h, m).strftime("%I:%M %p").lstrip("0")
                        slots.append({"value": value, "label": label})
                    cursor += slot_step

                return {"date": raw_date, "available_slots": slots, "total": len(slots)}

            # ── create_booking ───────────────────────────────────────────────
            elif name == "create_booking":
                raw_date = args.get("date")
                time_str = args.get("time")
                service_id = args.get("service_id")
                notes = args.get("notes", "")

                if not all([raw_date, time_str, service_id]):
                    return {"success": False, "error": "date, time, and service_id are required"}

                try:
                    book_date = date_type.fromisoformat(raw_date)
                except ValueError:
                    return {"success": False, "error": f"Invalid date: {raw_date}"}

                svc = (await db.execute(
                    select(models_pg.Service).where(models_pg.Service.id == service_id)
                )).scalar_one_or_none()
                if not svc:
                    return {"success": False, "error": "Service not found"}

                # Find or create customer record
                customer = None
                if identity.phone:
                    customer = (await db.execute(
                        select(models_pg.Customer).where(
                            models_pg.Customer.phone == identity.phone,
                            models_pg.Customer.company_id == outlet.company_id,
                        )
                    )).scalar_one_or_none()

                if not customer:
                    customer = models_pg.Customer(
                        id=str(uuid.uuid4()),
                        company_id=outlet.company_id,
                        name=identity.name or "Guest",
                        phone=identity.phone or "",
                        email=f"guest_{uuid.uuid4().hex[:8]}@guest.riserve.app",
                    )
                    db.add(customer)
                    await db.flush()

                booking_id = str(uuid.uuid4())
                booking = models_pg.Booking(
                    id=booking_id,
                    company_id=outlet.company_id,
                    outlet_id=outlet_id,
                    customer_id=customer.id,
                    customer_name=identity.name or "Guest",
                    customer_phone=identity.phone or "",
                    service_id=service_id,
                    date=book_date,
                    time=time_str,
                    duration=svc.duration or 30,
                    amount=float(svc.price or 0),
                    notes=notes,
                    status="Pending",
                    source="online",
                )
                db.add(booking)
                await db.flush()

                # Link service in the many-to-many table
                await db.execute(
                    models_pg.booking_services.insert().values(
                        booking_id=booking_id, service_id=service_id
                    )
                )
                await db.commit()

                return {
                    "success": True,
                    "booking_id": booking_id,
                    "date": raw_date,
                    "time": time_str,
                    "service_name": svc.name,
                    "status": "Pending",
                    "amount": float(svc.price or 0),
                }

            # ── get_my_bookings ──────────────────────────────────────────────
            elif name == "get_my_bookings":
                if not identity.phone:
                    return {"bookings": [], "message": "No phone number provided"}

                rows = (await db.execute(
                    select(models_pg.Booking, models_pg.Service)
                    .outerjoin(
                        models_pg.Service,
                        models_pg.Booking.service_id == models_pg.Service.id,
                    )
                    .where(
                        models_pg.Booking.outlet_id == outlet_id,
                        models_pg.Booking.customer_phone == identity.phone,
                    )
                    .order_by(models_pg.Booking.date.desc(), models_pg.Booking.time.desc())
                    .limit(10)
                )).all()

                bookings_list = []
                for b, svc in rows:
                    bookings_list.append({
                        "id": b.id,
                        "date": b.date.isoformat() if b.date else None,
                        "time": b.time,
                        "service": svc.name if svc else "Unknown",
                        "status": b.status,
                        "amount": float(b.amount or 0),
                    })

                return {"bookings": bookings_list}

            # ── reschedule_booking ───────────────────────────────────────────
            elif name == "reschedule_booking":
                booking_id = args.get("booking_id")
                new_date = args.get("new_date")
                new_time = args.get("new_time")

                booking = (await db.execute(
                    select(models_pg.Booking).where(
                        models_pg.Booking.id == booking_id,
                        models_pg.Booking.outlet_id == outlet_id,
                    )
                )).scalar_one_or_none()

                if not booking:
                    return {"success": False, "error": "Booking not found"}

                try:
                    booking.date = date_type.fromisoformat(new_date)
                except ValueError:
                    return {"success": False, "error": f"Invalid date: {new_date}"}

                booking.time = new_time
                booking.status = "Pending"
                await db.commit()

                return {
                    "success": True,
                    "booking_id": booking_id,
                    "new_date": new_date,
                    "new_time": new_time,
                }

            # ── cancel_booking ───────────────────────────────────────────────
            elif name == "cancel_booking":
                booking_id = args.get("booking_id")

                booking = (await db.execute(
                    select(models_pg.Booking).where(
                        models_pg.Booking.id == booking_id,
                        models_pg.Booking.outlet_id == outlet_id,
                    )
                )).scalar_one_or_none()

                if not booking:
                    return {"success": False, "error": "Booking not found"}

                booking.status = "Cancelled"
                await db.commit()

                return {"success": True, "booking_id": booking_id}

            # ── suggest_hairstyles ───────────────────────────────────────────
            elif name == "suggest_hairstyles":
                preferences = args.get("preferences", "")
                face_shape = args.get("face_shape", "")

                face_context = ""
                if face_description:
                    face_context = f"\nFace description from photo: {face_description}"
                if face_shape:
                    face_context += f"\nFace shape: {face_shape}"

                messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are an expert hairstylist. Given information about a customer, "
                            "suggest 4 hairstyle options. "
                            "Return ONLY a valid JSON array — no markdown, no extra text — like this:\n"
                            '[{"name":"...", "description":"...", "why_it_suits":"...", '
                            '"maintenance_level":"low|medium|high", "is_classic":true}]'
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Customer preferences: {preferences or 'no specific preference'}"
                            f"{face_context}\n\n"
                            "Suggest 4 hairstyles that would suit this person. "
                            "Return only the JSON array."
                        ),
                    },
                ]

                try:
                    async with httpx.AsyncClient(timeout=60) as client:
                        resp = await client.post(
                            _OPENROUTER_CHAT_URL,
                            headers=_HEADERS,
                            json={"model": _CHAT_MODEL, "messages": messages},
                        )
                    if resp.status_code != 200:
                        return {"error": f"AI service error: {resp.status_code}"}

                    raw = resp.json()["choices"][0]["message"]["content"].strip()
                    start = raw.find("[")
                    end = raw.rfind("]") + 1
                    suggestions = (
                        json.loads(raw[start:end]) if start >= 0 and end > start else []
                    )
                    return {"suggestions": suggestions}
                except Exception as exc:
                    logger.error(f"suggest_hairstyles failed: {exc}")
                    return {"error": str(exc)}

            # ── generate_hairstyle_image ─────────────────────────────────────
            elif name == "generate_hairstyle_image":
                hairstyle = args.get("hairstyle", "")
                face_desc = args.get("face_description", "") or face_description or "a person"
                beard_style = args.get("beard_style", "")

                beard_clause = f", {beard_style} beard" if beard_style else ", clean-shaven"
                prompt = (
                    f"Professional portrait photo of {face_desc} wearing a {hairstyle} hairstyle"
                    f"{beard_clause}. "
                    "Studio lighting, sharp focus, realistic skin texture, neutral background. "
                    "High quality headshot, photorealistic."
                )

                try:
                    async with httpx.AsyncClient(timeout=90) as client:
                        resp = await client.post(
                            _OPENROUTER_IMAGE_URL,
                            headers=_HEADERS,
                            json={
                                "model": _IMAGE_MODEL,
                                "prompt": prompt,
                                "n": 1,
                            },
                        )
                    if resp.status_code != 200:
                        return {"error": f"Image generation error: {resp.status_code}"}

                    data = resp.json()
                    image_url = (
                        data.get("data", [{}])[0].get("url")
                        or data.get("data", [{}])[0].get("b64_json", "")
                    )

                    # Emit the image_generated inline SSE event before returning the result
                    img_event = {
                        "type": "image_generated",
                        "url": image_url,
                        "hairstyle": hairstyle,
                        "beard": beard_style or "",
                    }
                    # We yield this by appending to a side-channel list consumed below
                    _inline_events.append(sse(img_event))

                    return {"image_url": image_url, "prompt": prompt}

                except Exception as exc:
                    logger.error(f"generate_hairstyle_image failed: {exc}")
                    return {"error": str(exc)}

            return {"error": f"Unknown tool: {name}"}

        # ── Build initial messages list ──────────────────────────────────────
        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": system_prompt}
        ] + [m.dict() for m in req.messages]

        # Side-channel for inline SSE events emitted by tools
        _inline_events: List[str] = []

        msg_counter = 0

        # ── Agentic loop (max 6 iterations) ─────────────────────────────────
        for _iteration in range(6):
            msg_id = f"msg_{msg_counter}"
            msg_counter += 1
            accumulated_text = ""

            # Track tool calls: {index: {id, name, arguments_str}}
            tool_calls_map: Dict[int, Dict[str, Any]] = {}

            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    async with client.stream(
                        "POST",
                        _OPENROUTER_CHAT_URL,
                        headers=_HEADERS,
                        json={
                            "model": _CHAT_MODEL,
                            "messages": messages,
                            "tools": TOOLS,
                            "tool_choice": "auto",
                            "stream": True,
                        },
                    ) as stream_resp:
                        if stream_resp.status_code != 200:
                            body = await stream_resp.aread()
                            logger.error(f"OpenRouter stream error {stream_resp.status_code}: {body}")
                            yield sse({"type": "error", "message": "AI service error"})
                            return

                        text_started = False

                        async for line in stream_resp.aiter_lines():
                            if not line.startswith("data: "):
                                continue
                            raw = line[6:].strip()
                            if raw == "[DONE]":
                                break

                            try:
                                chunk = json.loads(raw)
                            except json.JSONDecodeError:
                                continue

                            choice = (chunk.get("choices") or [{}])[0]
                            delta = choice.get("delta", {})

                            # ── Text delta ───────────────────────────────────
                            content_chunk = delta.get("content")
                            if content_chunk:
                                if not text_started:
                                    yield sse({"type": "text_start", "id": msg_id})
                                    text_started = True
                                accumulated_text += content_chunk
                                yield sse({"type": "text_delta", "id": msg_id, "delta": content_chunk})

                            # ── Tool call deltas ──────────────────────────────
                            for tc in delta.get("tool_calls") or []:
                                idx = tc.get("index", 0)
                                if idx not in tool_calls_map:
                                    tool_calls_map[idx] = {
                                        "id": tc.get("id", f"tc_{idx}"),
                                        "name": "",
                                        "arguments_str": "",
                                    }
                                tc_entry = tool_calls_map[idx]

                                # id only arrives on first chunk for this index
                                if tc.get("id"):
                                    tc_entry["id"] = tc["id"]

                                fn = tc.get("function", {})
                                if fn.get("name"):
                                    tc_entry["name"] = fn["name"]
                                if fn.get("arguments"):
                                    tc_entry["arguments_str"] += fn["arguments"]

            except Exception as exc:
                logger.error(f"Streaming error: {exc}")
                yield sse({"type": "error", "message": str(exc)})
                return

            # ── Close text block if any text was streamed ────────────────────
            if accumulated_text:
                yield sse({"type": "text_end", "id": msg_id})

            # ── No tool calls → we're done ────────────────────────────────────
            if not tool_calls_map:
                break

            # ── Execute tool calls ────────────────────────────────────────────
            assistant_tool_calls = []
            tool_results_messages = []

            for idx in sorted(tool_calls_map.keys()):
                tc_entry = tool_calls_map[idx]
                tc_id = tc_entry["id"]
                tool_name = tc_entry["name"]
                arguments_str = tc_entry["arguments_str"]

                try:
                    tool_args = json.loads(arguments_str) if arguments_str else {}
                except json.JSONDecodeError:
                    tool_args = {}

                yield sse({
                    "type": "tool_start",
                    "id": tc_id,
                    "name": tool_name,
                    "args": tool_args,
                })

                tool_result = await execute_tool(tool_name, tool_args)

                # Flush any inline SSE events emitted by the tool (e.g. image_generated)
                for inline_evt in _inline_events:
                    yield inline_evt
                _inline_events.clear()

                yield sse({
                    "type": "tool_result",
                    "id": tc_id,
                    "name": tool_name,
                    "result": tool_result,
                })

                assistant_tool_calls.append({
                    "id": tc_id,
                    "type": "function",
                    "function": {
                        "name": tool_name,
                        "arguments": json.dumps(tool_args),
                    },
                })

                tool_results_messages.append({
                    "role": "tool",
                    "tool_call_id": tc_id,
                    "content": json.dumps(tool_result),
                })

            # Append assistant message with tool_calls + tool results for next iteration
            assistant_msg: Dict[str, Any] = {"role": "assistant", "tool_calls": assistant_tool_calls}
            if accumulated_text:
                assistant_msg["content"] = accumulated_text
            messages.append(assistant_msg)
            messages.extend(tool_results_messages)

        yield sse({"type": "done"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
