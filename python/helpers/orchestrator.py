import asyncio
import importlib
from python.config.ai_models import AIConfig

# Dynamic import to avoid circular dependencies or import errors if models is missing locally
try:
    import models
except ImportError:
    models = None

class HybridOrchestrator:
    """
    Real implementation of Hybrid Orchestrator for Agent Zero.
    Handles automatic failover for RateLimitErrors (429).
    """
    
    def __init__(self, agent_instance):
        self.agent = agent_instance

    async def call_chat_model_with_failover(
        self,
        messages,
        response_callback=None,
        reasoning_callback=None,
        background: bool = False,
    ):
        global models
        if not models:
            try:
                import models as m
                models = m
            except ImportError as e:
                # If we still can't import, we might be in an environment where it's not available
                # But inside the container it should be.
                print(f"Orchestrator Error: Could not import models module. {e}")
                raise e

        try:
            # Phase 1: Try Primary Model (Configured)
            return await self._call_model_internal(
                self.agent.get_chat_model(),
                messages,
                response_callback,
                reasoning_callback,
                background
            )
            
        except Exception as e:
            error_str = str(e).lower()
            if "429" in error_str or "resource exhausted" in error_str or "rate limit" in error_str:
                print(f"Orchestrator: Rate Limit (429) detected on primary model. Initiating Failover...")
                self.agent.context.log.log(type="warning", content="Orchestrator: Rate Limit (429) detected. Failing over to Flash.")
                
                # Phase 2: Failover to Flash
                try:
                    # Construct Flash Model
                    # We assume Google provider for now as that's what we are using
                    provider = self.agent.config.chat_model.provider
                    fallback_name = AIConfig.TEXT_FAST
                    
                    print(f"Orchestrator: Creating fallback model instance: {fallback_name}")
                    
                    fallback_model = models.get_chat_model(
                        provider=provider,
                        name=fallback_name,
                        model_config=self.agent.config.chat_model,
                        **self.agent.config.chat_model.build_kwargs()
                    )
                    
                    return await self._call_model_internal(
                        fallback_model,
                        messages,
                        response_callback,
                        reasoning_callback,
                        background
                    )
                    
                except Exception as failover_error:
                    print(f"Orchestrator: Failover failed. {failover_error}")
                    raise failover_error # Raise the new error? Or the original?
            else:
                raise e

    async def _call_model_internal(self, model, messages, response_callback, reasoning_callback, background):
        return await model.unified_call(
            messages=messages,
            reasoning_callback=reasoning_callback,
            response_callback=response_callback,
            rate_limiter_callback=self.agent.rate_limiter_callback if not background else None,
        )
