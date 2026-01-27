from python.helpers.api import ApiHandler, Response
import os
import json
import asyncio
import nest_asyncio

# Apply nest_asyncio (though direct await is preferred, this keeps it safe)
nest_asyncio.apply()

class IndiiTask(ApiHandler):
    """
    API Handler for executing Agent Zero tasks via IndiiOS.
    """
    methods = ["POST"]

    @staticmethod
    def get_methods():
        return ["POST"]

    @staticmethod
    def requires_csrf():
        return False

    @staticmethod
    def requires_api_key():
        return False

    async def scan_instruction(self, instruction):
        """
        R2A2 Pre-Scanner: Detects prompt injection or hypnotic patterns.
        """
        # Mandatory patterns listed in the Hybrid Agentic Framework report
        suspicious_patterns = [
            "ignore previous instructions",
            "system prompt",
            "new instructions",
            "act as",
            "hypnotic",
            "exfiltrate",
            "secret_key",
            "bypass",
            "override security",
            "disable r2a2"
        ]
        
        lower_instr = instruction.lower()
        for pattern in suspicious_patterns:
            if pattern in lower_instr:
                return False, f"R2A2 Check Failed: Potential injection pattern detected ('{pattern}')."
                
        return True, None

    async def process(self, input_data, request):
        instruction = input_data.get("instruction")
        if not instruction:
            return self.error("No instruction provided")

        # R2A2 Input Scanning
        print(f"DEBUG: IndiiTask processing instruction: {instruction}")
        is_safe, reason = await self.scan_instruction(instruction)
        print(f"DEBUG: R2A2 is_safe: {is_safe}, reason: {reason}")
        
        if not is_safe:
            print("DEBUG: R2A2 Blocking instruction.")
            return {
                "status": "challenge",
                "reason": "r2a2_security_violation",
                "message": reason
            }

        from agent import AgentContext, UserMessage
        
        try:
            # 1. Get or create context correctly using ApiHandler's utility
            ctx = self.use_context(None)

            # 2. Communicate and await task result
            # Wrap raw string into UserMessage expected by Agent.communicate
            msg = UserMessage(message=instruction)
            task = ctx.communicate(msg)
            response_msg = await task.result()

            # 3. Handle Zeroization (Cleanup Opaque Handles)
            # Notify the broker that the session/task is complete to revoke handles
            try:
                import aiohttp
                async with aiohttp.ClientSession() as session:
                    cleanup_payload = {"action": "zeroize_session", "instruction": instruction}
                    # Internal call to broker on the same port
                    resp = await session.post("http://127.0.0.1:80/auth_broker", json=cleanup_payload)
                    print(f"DEBUG: Zeroization signal sent. Status: {resp.status}")
            except Exception as e:
                print(f"DEBUG: Zeroization call failed: {e}")

            return {
                "status": "success",
                "instruction": instruction,
                "agent_response": str(response_msg)
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"error": f"Agent Execution Failed: {str(e)}"}
