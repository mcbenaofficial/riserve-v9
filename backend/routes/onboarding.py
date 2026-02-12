"""
Onboarding Routes — SSE streaming chat and progress endpoints for AI onboarding.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import json
import logging

from langchain_core.messages import HumanMessage, AIMessage, BaseMessage

from .dependencies import (
    get_current_user, User,
    companies_collection, users_collection, db
)

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])
logger = logging.getLogger(__name__)


# ─── Models ─────────────────────────────────────────────────────

class OnboardingChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    stream: bool = True


# ─── Routes ─────────────────────────────────────────────────────

@router.get("/progress")
async def get_progress(current_user: User = Depends(get_current_user)):
    """Get onboarding progress for current user's company."""
    company_id = current_user.company_id
    if not company_id:
        return {
            "percentage": 0,
            "completed_steps": [],
            "pending_steps": ["company_profile", "first_outlet", "services"],
            "skipped": False,
            "completed_at": None,
        }
    
    progress = await db.onboarding_progress.find_one(
        {"company_id": company_id}, {"_id": 0}
    )
    
    if not progress:
        return {
            "percentage": 0,
            "completed_steps": [],
            "pending_steps": ["company_profile", "first_outlet", "services"],
            "skipped": False,
            "completed_at": None,
        }
    
    return {
        "percentage": progress.get("percentage", 0),
        "completed_steps": progress.get("completed_steps", []),
        "pending_steps": progress.get("pending_steps", []),
        "skipped": progress.get("skipped", False),
        "completed_at": progress.get("completed_at"),
        "conversation_id": progress.get("conversation_id"),
    }


@router.post("/skip")
async def skip_onboarding(current_user: User = Depends(get_current_user)):
    """Mark onboarding as skipped — user can resume later."""
    company_id = current_user.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="No company found.")
    
    await db.onboarding_progress.update_one(
        {"company_id": company_id},
        {
            "$set": {
                "skipped": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    
    return {"message": "Onboarding skipped. You can resume anytime."}


@router.post("/chat")
async def onboarding_chat(
    request: OnboardingChatRequest,
    current_user: User = Depends(get_current_user),
):
    """SSE streaming chat endpoint for onboarding conversation."""
    
    # ─── SETUP (Common for both modes) ──────────────────────────────────
    company_id = current_user.company_id

    company = None
    if company_id:
        company = await companies_collection.find_one(
            {"id": company_id}, {"_id": 0}
        )
    
    company_name = company.get("name", "") if company else ""
    business_type = company.get("business_type", "") if company else ""
    user_name = current_user.name or ""
    
    # Get or create conversation
    conversation_id = request.conversation_id
    conversation = None
    
    if conversation_id:
        conversation = await db.onboarding_conversations.find_one(
            {"id": conversation_id, "user_id": current_user.id}, {"_id": 0}
        )
    
    if not conversation:
        conversation_id = str(uuid.uuid4())
        conversation = {
            "id": conversation_id,
            "user_id": current_user.id,
            "company_id": company_id,
            "messages": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.onboarding_conversations.insert_one(conversation)
        
        # Link conversation to progress
        await db.onboarding_progress.update_one(
            {"company_id": company_id},
            {
                "$set": {"conversation_id": conversation_id},
                "$setOnInsert": {
                    "percentage": 0,
                    "completed_steps": [],
                    "pending_steps": ["company_profile", "first_outlet", "services"],
                    "skipped": False,
                    "completed_at": None,
                }
            },
            upsert=True,
        )
    
    # Build chat history
    chat_history = []
    if conversation.get("messages"):
        for msg in conversation["messages"][-10:]:
            if msg["role"] == "user":
                chat_history.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                chat_history.append(AIMessage(content=msg["content"]))
    
    # Send current progress (fetch early for state injection)
    progress = await db.onboarding_progress.find_one(
        {"company_id": company_id}, {"_id": 0}
    )
    
    if not progress:
        progress = {
            "percentage": 0,
            "completed_steps": [],
            "pending_steps": ["company_profile", "first_outlet", "services"],
            "skipped": False,
            "completed_at": None,
        }

    # ─── NON-STREAMING MODE ─────────────────────────────────────────
    if not request.stream:
        # Build onboarding swarm
        user_context = {
            "user_id": current_user.id,
            "role": current_user.role,
            "company_id": company_id,
        }
        
        from onboarding_agents import get_onboarding_swarm
        agent_app = get_onboarding_swarm(
            user_context,
            company_name=company_name,
            business_type=business_type,
            user_name=user_name,
            current_progress=progress if progress else {}
        )

        if not agent_app:
                raise HTTPException(status_code=500, detail="AI Agent offline")

        # Run swarm synchronously (invoke)
        messages = chat_history + [HumanMessage(content=request.message)]
        result = await agent_app.ainvoke({"messages": messages})
        last_message = result["messages"][-1]
        response_text = last_message.content

        # Save to DB
        user_msg_doc = {
            "id": str(uuid.uuid4()),
            "role": "user",
            "content": request.message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        assistant_msg_doc = {
            "id": str(uuid.uuid4()),
            "role": "assistant",
            "content": response_text,
            "active_agent": "Onboarding", # Simplified
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message_type": "text"
        }
        
        await db.onboarding_conversations.update_one(
            {"id": conversation_id},
            {
                "$push": {"messages": {"$each": [user_msg_doc, assistant_msg_doc]}},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
            },
        )

        # Return JSON
        from fastapi.responses import JSONResponse
        return JSONResponse({
            "message": assistant_msg_doc,
            "conversation_id": conversation_id
        })

    # ─── STREAMING MODE ─────────────────────────────────────────────
    async def event_generator():
        try:
            # Send conversation_id immediately
            yield f"data: {json.dumps({'type': 'conversation_id', 'conversation_id': conversation_id})}\n\n"
            
            # Send current progress
            yield f"data: {json.dumps({'type': 'progress', 'progress': {'percentage': progress.get('percentage', 0), 'completed_steps': progress.get('completed_steps', []), 'pending_steps': progress.get('pending_steps', [])}})}\n\n"

            # Build onboarding swarm
            user_context = {
                "user_id": current_user.id,
                "role": current_user.role,
                "company_id": company_id,
            }
            
            from onboarding_agents import get_onboarding_swarm
            agent_app = get_onboarding_swarm(
                user_context,
                company_name=company_name,
                business_type=business_type,
                user_name=user_name,
                current_progress=progress if progress else {}
            )
            
            if not agent_app:
                yield f"data: {json.dumps({'type': 'error', 'content': 'AI Agent is offline (API Key missing). Please use the form below.'})}\n\n"
                return
            
            # Run swarm with streaming
            messages = chat_history + [HumanMessage(content=request.message)]
            
            thinking_process = []
            response_text = ""
            active_agent = "OnboardingTriageAgent"
            
            agent_names = {
                "OnboardingTriageAgent", "CompanySetupAgent",
                "OutletConfigAgent", "ServiceSetupAgent", "DataImportAgent"
            }
            

            async for event in agent_app.astream_events(
                {"messages": messages},
                version="v2"
            ):
                kind = event.get("event", "")
                name = event.get("name", "")
                
                # Detect agent handoffs
                if kind == "on_chain_start" and name in agent_names and name != active_agent:
                    active_agent = name
                    step = {
                        "type": "agent_handoff",
                        "agent": active_agent,
                    }
                    thinking_process.append(step)
                    yield f"data: {json.dumps({'type': 'thinking_step', 'step': step})}\n\n"
                
                # Tool call started
                elif kind == "on_tool_start":
                    tool_name = event.get("name", "unknown")
                    if "transfer_to_" in tool_name.lower():
                        continue
                    step = {
                        "type": "tool_call",
                        "name": tool_name,
                        "args": event.get("data", {}).get("input", {}),
                        "agent": active_agent,
                    }
                    thinking_process.append(step)
                    yield f"data: {json.dumps({'type': 'thinking_step', 'step': step})}\n\n"
                
                # Tool call finished
                elif kind == "on_tool_end":
                    tool_name = event.get("name", "unknown")
                    if "transfer_to_" in tool_name.lower():
                        continue
                    output = event.get("data", {}).get("output", "")
                    if hasattr(output, 'content'):
                        output = output.content
                    step = {
                        "type": "tool_output",
                        "content": str(output)[:500],
                        "name": tool_name,
                        "agent": active_agent,
                    }
                    thinking_process.append(step)
                    yield f"data: {json.dumps({'type': 'thinking_step', 'step': step})}\n\n"
                    
                    # If a milestone tool completed, send updated progress
                    if tool_name in ["update_company_profile", "create_outlet", "create_services_batch"]:
                        updated_progress = await db.onboarding_progress.find_one(
                            {"company_id": company_id}, {"_id": 0}
                        )
                        if updated_progress:
                            yield f"data: {json.dumps({'type': 'progress', 'progress': {'percentage': updated_progress.get('percentage', 0), 'completed_steps': updated_progress.get('completed_steps', []), 'pending_steps': updated_progress.get('pending_steps', [])}})}\n\n"
                
                # Stream response tokens
                elif kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk", None)
                    if chunk and hasattr(chunk, 'content') and chunk.content:
                        if not (hasattr(chunk, 'tool_calls') and chunk.tool_calls):
                            response_text += chunk.content
                            yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"
            
            # Fallback if no streaming tokens
            if not response_text:
                result = await agent_app.ainvoke({"messages": messages})
                last_message = result["messages"][-1]
                response_text = last_message.content
                yield f"data: {json.dumps({'type': 'answer', 'content': response_text})}\n\n"
            
            # Save to DB
            user_msg_doc = {
                "id": str(uuid.uuid4()),
                "role": "user",
                "content": request.message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            
            assistant_msg_doc = {
                "id": str(uuid.uuid4()),
                "role": "assistant",
                "content": response_text,
                "thinking_process": thinking_process,
                "active_agent": active_agent,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            
            await db.onboarding_conversations.update_one(
                {"id": conversation_id},
                {
                    "$push": {"messages": {"$each": [user_msg_doc, assistant_msg_doc]}},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
                },
            )
            
            # Send final progress and done event
            final_progress = await db.onboarding_progress.find_one(
                {"company_id": company_id}, {"_id": 0}
            )
            
            yield f"data: {json.dumps({'type': 'done', 'message': assistant_msg_doc, 'progress': {'percentage': final_progress.get('percentage', 0) if final_progress else 0, 'completed_steps': final_progress.get('completed_steps', []) if final_progress else [], 'pending_steps': final_progress.get('pending_steps', []) if final_progress else []}})}\n\n"
        
        except Exception as e:
            logger.error(f"Onboarding stream error: {str(e)}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

