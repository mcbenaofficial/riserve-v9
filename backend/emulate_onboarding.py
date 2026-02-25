import os
import asyncio
import logging
import uuid
from typing import Dict, Any
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, AIMessage

# Setup environment and logging
load_dotenv()
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# Import Ri'Serve modules
from onboarding_agents import get_onboarding_swarm

async def emulate_onboarding():
    print("\n" + "="*50)
    print("Ri'Serve Onboarding Swarm Emulation")
    print("="*50)
    
    # Mock User Context
    user_context = {
        "user_id": "test-user-123",
        "role": "Admin",
        "company_id": "demo-company-id" # In a real test, this should be valid in DB
    }
    
    # Progress Mock
    current_progress = {
        "completed_steps": [],
        "pending_steps": ["company_profile", "first_outlet", "services"]
    }
    
    # Initialize Agent
    agent_app = get_onboarding_swarm(
        user_context=user_context,
        company_name="Antigravity Services",
        business_type="Automotive",
        user_name="Josh",
        current_progress=current_progress
    )
    
    if not agent_app:
        print("Error: Could not initialize onboarding swarm. Check OPENROUTER_API_KEY.")
        return

    chat_history = []
    print("\nAssistant: (Waiting for first message. Type 'exit' to quit)\n")
    
    while True:
        user_input = input("You: ")
        if user_input.lower() in ["exit", "quit", "q"]:
            break
            
        messages = chat_history + [HumanMessage(content=user_input)]
        
        print("\nThinking...")
        try:
            # We use ainvoke as the agents are async
            result = await agent_app.ainvoke({"messages": messages})
            
            # The swarm returns the updated state with messages
            last_message = result["messages"][-1]
            response_text = last_message.content
            
            print(f"\nAssistant: {response_text}\n")
            
            # Update history
            chat_history = result["messages"]
            
        except Exception as e:
            print(f"\nError interacting with agent: {e}")
            break

if __name__ == "__main__":
    # Ensure nested event loops don't crash
    try:
        asyncio.run(emulate_onboarding())
    except KeyboardInterrupt:
        print("\nExiting emulation...")
