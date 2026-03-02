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
    get_current_user, User, get_db
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import models_pg

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])
logger = logging.getLogger(__name__)


# ─── Models ─────────────────────────────────────────────────────

class OnboardingChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    stream: bool = True


# ─── Routes ─────────────────────────────────────────────────────

@router.get("/progress")
async def get_progress(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
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
    
    stmt = select(models_pg.Company).where(models_pg.Company.id == company_id)
    company = (await db_session.execute(stmt)).scalar_one_or_none()
    
    # We will store progress directly on the company model's onboarding_state JSONB field
    # Assuming we add onboarding_state to Company later; but since we didn't, let's add `onboarding_progress` to Company model or use custom_fields. 
    # Let's assume we can map this to a separate table `OnboardingProgress` we will add in `models_pg`
    
    stmt = select(models_pg.OnboardingProgress).where(models_pg.OnboardingProgress.company_id == company_id)
    progress_rec = (await db_session.execute(stmt)).scalar_one_or_none()
    
    if not progress_rec:
        return {
            "percentage": 0,
            "completed_steps": [],
            "pending_steps": ["company_profile", "first_outlet", "services"],
            "skipped": False,
            "completed_at": None,
        }
    
    return {
        "percentage": progress_rec.percentage,
        "completed_steps": progress_rec.completed_steps,
        "pending_steps": progress_rec.pending_steps,
        "skipped": progress_rec.skipped,
        "completed_at": progress_rec.completed_at.isoformat() if progress_rec.completed_at else None,
        "conversation_id": progress_rec.conversation_id,
    }


@router.post("/skip")
async def skip_onboarding(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Mark onboarding as skipped — user can resume later."""
    company_id = current_user.company_id
    if not company_id:
        raise HTTPException(status_code=400, detail="No company found.")
    
    stmt = select(models_pg.OnboardingProgress).where(models_pg.OnboardingProgress.company_id == company_id)
    progress_rec = (await db_session.execute(stmt)).scalar_one_or_none()
    
    if progress_rec:
        progress_rec.skipped = True
        progress_rec.updated_at = datetime.now(timezone.utc)
    else:
        new_prog = models_pg.OnboardingProgress(
            id=str(uuid.uuid4()),
            company_id=company_id,
            skipped=True
        )
        db_session.add(new_prog)
        
    await db_session.commit()
    return {"message": "Onboarding skipped. You can resume anytime."}


@router.post("/chat")
async def onboarding_chat(
    request: OnboardingChatRequest,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """SSE streaming chat endpoint for onboarding conversation."""
    
    # ─── SETUP (Common for both modes) ──────────────────────────────────
    company_id = current_user.company_id

    company = None
    if company_id:
        stmt = select(models_pg.Company).where(models_pg.Company.id == company_id)
        company = (await db_session.execute(stmt)).scalar_one_or_none()
    
    company_name = company.name if company else ""
    business_type = company.business_type if company else ""
    user_name = current_user.name or ""
    
    # Get or create conversation
    conversation_id = request.conversation_id
    conversation = None
    
    if conversation_id:
        stmt = select(models_pg.OnboardingConversation).where(
            models_pg.OnboardingConversation.id == conversation_id,
            models_pg.OnboardingConversation.user_id == current_user.id
        )
        conversation = (await db_session.execute(stmt)).scalar_one_or_none()
    
    if not conversation:
        conversation_id = str(uuid.uuid4())
        conversation = models_pg.OnboardingConversation(
            id=conversation_id,
            user_id=current_user.id,
            company_id=company_id,
            messages=[]
        )
        db_session.add(conversation)
        
        # Link conversation to progress
        prog_stmt = select(models_pg.OnboardingProgress).where(models_pg.OnboardingProgress.company_id == company_id)
        prog_rec = (await db_session.execute(prog_stmt)).scalar_one_or_none()
        
        if prog_rec:
            prog_rec.conversation_id = conversation_id
        else:
            new_prog = models_pg.OnboardingProgress(
                id=str(uuid.uuid4()),
                company_id=company_id,
                conversation_id=conversation_id,
                percentage=0,
                completed_steps=[],
                pending_steps=["company_profile", "first_outlet", "services"],
                skipped=False
            )
            db_session.add(new_prog)
            
        await db_session.commit()
    
    # Build chat history
    chat_history = []
    if conversation and conversation.messages:
        for msg in conversation.messages[-10:]:
            if msg.get("role") == "user":
                chat_history.append(HumanMessage(content=msg.get("content", "")))
            elif msg.get("role") == "assistant":
                chat_history.append(AIMessage(content=msg.get("content", "")))
    
    # Send current progress (fetch early for state injection)
    prog_stmt = select(models_pg.OnboardingProgress).where(models_pg.OnboardingProgress.company_id == company_id)
    progress_rec = (await db_session.execute(prog_stmt)).scalar_one_or_none()
    
    if not progress_rec:
        progress_dict = {
            "percentage": 0,
            "completed_steps": [],
            "pending_steps": ["company_profile", "first_outlet", "services"],
            "skipped": False,
            "completed_at": None,
        }
    else:
        progress_dict = {
            "percentage": progress_rec.percentage,
            "completed_steps": progress_rec.completed_steps,
            "pending_steps": progress_rec.pending_steps,
            "skipped": progress_rec.skipped,
            "completed_at": progress_rec.completed_at.isoformat() if progress_rec.completed_at else None,
            "conversation_id": progress_rec.conversation_id,
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
            current_progress=progress_dict
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
        
        if conversation:
            current_msgs = conversation.messages or []
            current_msgs.extend([user_msg_doc, assistant_msg_doc])
            
            # sqlalchemy needs this variable reassigned to trigger array update properly
            import copy
            conversation.messages = copy.deepcopy(current_msgs)
            conversation.updated_at = datetime.now(timezone.utc)
            await db_session.commit()

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
            yield f"data: {json.dumps({'type': 'progress', 'progress': {'percentage': progress_dict.get('percentage', 0), 'completed_steps': progress_dict.get('completed_steps', []), 'pending_steps': progress_dict.get('pending_steps', [])}})}\n\n"

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
                current_progress=progress_dict
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
                        from database_pg import async_session_maker
                        # create an ad-hoc session to read the updated progress from DB
                        async with async_session_maker() as sub_db_session:
                            sub_stmt = select(models_pg.OnboardingProgress).where(models_pg.OnboardingProgress.company_id == company_id)
                            updated_progress_rec = (await sub_db_session.execute(sub_stmt)).scalar_one_or_none()
                            
                            if updated_progress_rec:
                                yield f"data: {json.dumps({'type': 'progress', 'progress': {'percentage': updated_progress_rec.percentage, 'completed_steps': updated_progress_rec.completed_steps, 'pending_steps': updated_progress_rec.pending_steps}})}\n\n"
                
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
            
            from database_pg import async_session_maker
            async with async_session_maker() as sub_db_session:
                sub_stmt = select(models_pg.OnboardingConversation).where(models_pg.OnboardingConversation.id == conversation_id)
                conversation_rec = (await sub_db_session.execute(sub_stmt)).scalar_one_or_none()
                if conversation_rec:
                    current_msgs = conversation_rec.messages or []
                    current_msgs.extend([user_msg_doc, assistant_msg_doc])
                    import copy
                    conversation_rec.messages = copy.deepcopy(current_msgs)
                    conversation_rec.updated_at = datetime.now(timezone.utc)
                    await sub_db_session.commit()
            
            # Send final progress and done event
            async with async_session_maker() as sub_db_session:
                sub_stmt = select(models_pg.OnboardingProgress).where(models_pg.OnboardingProgress.company_id == company_id)
                final_progress = (await sub_db_session.execute(sub_stmt)).scalar_one_or_none()
            
                yield f"data: {json.dumps({'type': 'done', 'message': assistant_msg_doc, 'progress': {'percentage': final_progress.percentage if final_progress else 0, 'completed_steps': final_progress.completed_steps if final_progress else [], 'pending_steps': final_progress.pending_steps if final_progress else []}})}\n\n"
        
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

