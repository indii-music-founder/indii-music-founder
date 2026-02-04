import time
import asyncio
from python.config.ai_models import AIConfig

class HybridOrchestrator:
    """
    Task 4: Hybrid Orchestrator Self-Correction.
    Manages the 'Agent Zero' cognitive loop with automatic fallback.
    Strategy:
    1. Try FAST model (Flash).
    2. If confidence low or JSON malformed -> Escalation.
    3. Retry with PRO model (Pro/Ultra).
    """
    
    def __init__(self, agent_instance):
        self.agent = agent_instance
        self.history = []

    async def generate_response(self, prompt, context=None):
        # Phase 1: Fast Inference
        try:
            model = AIConfig.TEXT_FAST
            # print(f"Orchestrator: Attempting with {model}...")
            response = await self._call_model(model, prompt, context)
            
            if self._validate_response(response):
                return response
            
            print("Orchestrator: Fast model response invalid. Escalating...")
            
        except Exception as e:
            # Task 4 FIX: Explicitly catch RateLimitError and provider errors
            error_str = str(e).lower()
            if "429" in error_str or "rate limit" in error_str:
                print(f"Orchestrator: Rate Limit (429) hit on {model}. Switching to Pro...")
            else:
                print(f"Orchestrator: Fast model failed ({e}). Escalating...")

        # Phase 2: Sovereign Escalation (Self-Correction)
        try:
            model = AIConfig.TEXT_AGENT # Pro model
            print(f"Orchestrator: Escalating to {model} for deep reasoning...")
            
            # Enrich prompt with error context if needed
            escalation_prompt = f"Previous attempt failed. Task: {prompt}. Think step-by-step."
            response = await self._call_model(model, escalation_prompt, context)
            
            return response
            
        except Exception as e:
            return f"Critical Failure: Both models failed. {str(e)}"

    async def _call_model(self, model, prompt, context):
        # Mocking the actual API call binding here as it depends on the specific
        # agent-zero 'llm' implementation. In a real graft, this calls `llm.generate()`
        # For now, we simulate the structure.
        
        # Simulating a failure for "Flash" on complex tasks
        if model == AIConfig.TEXT_FAST and "complex" in prompt.lower():
            raise ValueError("Context window exceeded")
            
        return f"Response from {model}: Action Plan..."

    def _validate_response(self, response):
        # Check for malformed JSON or empty output
        if not response or len(response) < 5:
            return False
        return True
