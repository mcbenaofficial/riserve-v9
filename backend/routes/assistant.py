from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import os
import logging
import json

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage
from langgraph.prebuilt import create_react_agent
from langchain_core.tools import StructuredTool
import functools

from .dependencies import (
    ai_conversations_collection, outlets_collection,
    bookings_collection, services_collection,
    get_current_user, User
)
from agent_tools import all_tools
from swarm_agents import get_swarm_app


router = APIRouter(prefix="/assistant", tags=["AI Assistant"])
logger = logging.getLogger(__name__)

# --- Models ---

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class ImageGenerationRequest(BaseModel):
    prompt: str
    conversation_id: Optional[str] = None

# --- Helper: Initialize Agent ---

def get_agent_executor(tools: List[Any]):
    """
    Initialize the LangGraph agent with OpenRouter.
    """
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        logger.warning("OPENROUTER_API_KEY not found. Agent will fail.")
        return None

    llm = ChatOpenAI(
        model="openai/gpt-4o", # Default high-performance model
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.7
    )

    system_message = """You are Ri'Serve Super Agent, an advanced AI assistant for the Ri'Serve business management platform.
    
    Your Capabilities:
    1. Access real-time business data (Bookings, Revenue, Inventory) via tools.
    2. Perform actions like creating bookings (if authorized).
    3. Provide insights and strategic advice based on data.
    
    Security & RBAC:
    - You are acting on behalf of a specific user.
    - ALWAYS verify permissions implicitly by using the provided tools which enforce RBAC.
    - If a tool returns an error about permissions, politely inform the user.
    
    Tone:
    - Professional, helpful, and data-driven.
    - Use "We" when referring to the platform.
    
    Current Time: {time}
    """
    
    # LangGraph create_react_agent automatically handles tool calling loop
    # In this version, it uses 'prompt' for system messages
    app = create_react_agent(llm, tools, prompt=system_message)
    return app



# --- Routes ---

@router.get("/conversations")
async def get_conversations(current_user: User = Depends(get_current_user)):
    conversations = await ai_conversations_collection.find(
        {"user_id": current_user.id}, {"_id": 0}
    ).sort("updated_at", -1).limit(50).to_list(50)
    return conversations


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, current_user: User = Depends(get_current_user)):
    conversation = await ai_conversations_collection.find_one(
        {"id": conversation_id, "user_id": current_user.id}, {"_id": 0}
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, current_user: User = Depends(get_current_user)):
    result = await ai_conversations_collection.delete_one(
        {"id": conversation_id, "user_id": current_user.id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"message": "Conversation deleted"}


@router.post("/chat")
async def chat_with_assistant(request: ChatRequest, current_user: User = Depends(get_current_user)):
    try:
        # 1. Get or Create Conversation
        conversation_id = request.conversation_id
        conversation = None
        
        if conversation_id:
            conversation = await ai_conversations_collection.find_one(
                {"id": conversation_id, "user_id": current_user.id}, {"_id": 0}
            )
        
        if not conversation:
            conversation_id = str(uuid.uuid4())
            conversation = {
                "id": conversation_id,
                "user_id": current_user.id,
                "title": request.message[:50] + "..." if len(request.message) > 50 else request.message,
                "messages": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await ai_conversations_collection.insert_one(conversation)
            
        # 2. Prepare Chat History for LangChain
        chat_history = []
        if conversation.get("messages"):
            # Load last 10 messages for context
            for msg in conversation["messages"][-10:]:
                if msg["role"] == "user":
                    chat_history.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    chat_history.append(AIMessage(content=msg["content"]))

        # 3. Build Swarm with User Context
        user_context = {
            "user_id": current_user.id,
            "role": current_user.role,
            "company_id": current_user.company_id
        }
        
        agent_app = get_swarm_app(user_context)
        
        if not agent_app:
            response_text = "AI Agent is offline (Configuration Error: API Key missing)."
        else:
            # 4. Run Swarm Agent
            messages = chat_history + [HumanMessage(content=request.message)]
            
            result = await agent_app.ainvoke({"messages": messages})
            
            # Result contains 'messages' list. Last message should be AIMessage.
            last_message = result["messages"][-1]
            response_text = last_message.content

            # Extract Thinking Process
            thinking_process = []
            # We skip the initial messages we sent (system + chat history + user query)
            # The new messages generated by the agent start after our input messages.
            # However, result["messages"] returns ALL messages including input.
            # We want everything *generated* in this turn.
            
            # Identify the new messages:
            # They are the ones appended after our input 'messages' list.
            # But 'messages' variable was modified locally.
            # A safer way is to inspect messages that are ToolMessage or AIMessage with tool_calls
            # that appear *after* the last HumanMessage (which is our input).
            
            # Find index of last user message
            start_index = 0
            for i in range(len(result["messages"]) - 1, -1, -1):
                if isinstance(result["messages"][i], HumanMessage):
                    start_index = i + 1
                    break
            
            generated_messages = result["messages"][start_index:]
            
            for msg in generated_messages:
                if isinstance(msg, AIMessage) and msg.tool_calls:
                    for tool_call in msg.tool_calls:
                        thinking_process.append({
                            "type": "tool_call",
                            "name": tool_call["name"],
                            "args": tool_call["args"],
                            "id": tool_call["id"]
                        })
                elif isinstance(msg, BaseMessage) and msg.type == "tool": 
                    # LangChain Core ToolMessage has .type='tool'
                    # It might be an instance of ToolMessage class
                    thinking_process.append({
                        "type": "tool_output",
                        "content": msg.content,
                        "tool_call_id": msg.tool_call_id,
                        "name": msg.name
                    })

        # 5. Save to DB
        user_msg_doc = {
            "id": str(uuid.uuid4()),
            "role": "user",
            "content": request.message,
            "message_type": "text",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        assistant_msg_doc = {
            "id": str(uuid.uuid4()),
            "role": "assistant",
            "content": response_text,
            "message_type": "text",
            "thinking_process": thinking_process, # Save to DB
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await ai_conversations_collection.update_one(
            {"id": conversation_id},
            {
                "$push": {"messages": {"$each": [user_msg_doc, assistant_msg_doc]}},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        
        return {
            "conversation_id": conversation_id,
            "message": assistant_msg_doc,
            "success": True
        }

    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        # raise HTTPException(status_code=500, detail=str(e)) # Don't crash client
        return {
            "conversation_id": request.conversation_id,
            "message": {
                "id": str(uuid.uuid4()),
                "role": "assistant",
                "content": f"I encountered an error processing your request: {str(e)}",
                "message_type": "text",
                "timestamp": datetime.now(timezone.utc).isoformat()
            },
            "success": False
        }

@router.post("/generate-image")
async def generate_image(request: ImageGenerationRequest, current_user: User = Depends(get_current_user)):
    # Placeholder for image generation
    return {
        "success": False, 
        "message": "Image generation is not yet implemented in the Super Agent."
    }


@router.post("/chat/stream")
async def chat_with_assistant_stream(request: ChatRequest, current_user: User = Depends(get_current_user)):
    """SSE streaming endpoint - sends thinking steps in real-time as the agent works."""
    from fastapi.responses import StreamingResponse
    import asyncio

    async def event_generator():
        try:
            # 1. Get or Create Conversation
            conversation_id = request.conversation_id
            conversation = None
            
            if conversation_id:
                conversation = await ai_conversations_collection.find_one(
                    {"id": conversation_id, "user_id": current_user.id}, {"_id": 0}
                )
            
            if not conversation:
                conversation_id = str(uuid.uuid4())
                conversation = {
                    "id": conversation_id,
                    "user_id": current_user.id,
                    "title": request.message[:50] + "..." if len(request.message) > 50 else request.message,
                    "messages": [],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                await ai_conversations_collection.insert_one(conversation)
            
            # Send conversation_id immediately
            yield f"data: {json.dumps({'type': 'conversation_id', 'conversation_id': conversation_id})}\n\n"
            
            # 2. Prepare Chat History
            chat_history = []
            if conversation.get("messages"):
                for msg in conversation["messages"][-10:]:
                    if msg["role"] == "user":
                        chat_history.append(HumanMessage(content=msg["content"]))
                    elif msg["role"] == "assistant":
                        chat_history.append(AIMessage(content=msg["content"]))
            
            # 3. Build Swarm with User Context
            user_context = {
                "user_id": current_user.id,
                "role": current_user.role,
                "company_id": current_user.company_id
            }
            
            agent_app = get_swarm_app(user_context)
            
            if not agent_app:
                yield f"data: {json.dumps({'type': 'error', 'content': 'AI Agent is offline (API Key missing).'})}\n\n"
                return
            
            # 4. Run Swarm with Streaming
            messages = chat_history + [HumanMessage(content=request.message)]
            
            thinking_process = []
            response_text = ""
            active_agent = "TriageAgent"
            
            # Track agent names for handoff detection
            agent_names = {"TriageAgent", "BookingsAgent", "RevenueAgent", "InventoryAgent"}
            
            async for event in agent_app.astream_events(
                {"messages": messages},
                version="v2"
            ):
                kind = event.get("event", "")
                name = event.get("name", "")
                tags = event.get("tags", [])
                
                # Detect agent handoffs via graph node transitions
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
                    # Skip internal handoff tool calls from display
                    if "transfer_to_" in tool_name.lower():
                        continue
                    step = {
                        "type": "tool_call",
                        "name": tool_name,
                        "args": event.get("data", {}).get("input", {}),
                        "id": event.get("run_id", ""),
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
                        "tool_call_id": event.get("run_id", ""),
                        "agent": active_agent,
                    }
                    thinking_process.append(step)
                    yield f"data: {json.dumps({'type': 'thinking_step', 'step': step})}\n\n"
                
                # Final AI response token
                elif kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk", None)
                    if chunk and hasattr(chunk, 'content') and chunk.content:
                        if not (hasattr(chunk, 'tool_calls') and chunk.tool_calls):
                            response_text += chunk.content
                            yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"
            
            # If no streaming tokens produced, get final answer from full invocation
            if not response_text:
                result = await agent_app.ainvoke({"messages": messages})
                last_message = result["messages"][-1]
                response_text = last_message.content
                yield f"data: {json.dumps({'type': 'answer', 'content': response_text})}\n\n"
            
            # 5. Save to DB
            user_msg_doc = {
                "id": str(uuid.uuid4()),
                "role": "user",
                "content": request.message,
                "message_type": "text",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            assistant_msg_doc = {
                "id": str(uuid.uuid4()),
                "role": "assistant",
                "content": response_text,
                "message_type": "text",
                "thinking_process": thinking_process,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            await ai_conversations_collection.update_one(
                {"id": conversation_id},
                {
                    "$push": {"messages": {"$each": [user_msg_doc, assistant_msg_doc]}},
                    "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
                }
            )
            
            # Send final done event with full message
            yield f"data: {json.dumps({'type': 'done', 'message': assistant_msg_doc})}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {str(e)}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
