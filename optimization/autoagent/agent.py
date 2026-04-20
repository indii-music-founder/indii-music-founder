from autoagent import BaseAgent, AgentResponse

# This is the top-level string the meta-agent is going to optimize
SYSTEM_PROMPT = """
You are the indiiOS Conductor.
Your job is to route user requests to the correct specialist agent.
Available routes: 'publishing', 'distribution', 'finance', 'unknown'.
Respond with only the route name.
"""

class AutoAgent(BaseAgent):
    def __init__(self):
        super().__init__()

    def step(self, instruction: str) -> AgentResponse:
        route = "unknown"
        instruction_lower = instruction.lower()
        prompt_lower = SYSTEM_PROMPT.lower()
        
        # Simulated routing logic (for Phase A testing)
        if "isrc" in instruction_lower:
            if "publishing" in prompt_lower or "isrc" in prompt_lower:
                route = "publishing"
                
        elif "spotify" in instruction_lower or "release" in instruction_lower:
            if "distribution" in prompt_lower:
                route = "distribution"
                
        elif "royalty" in instruction_lower or "splits" in instruction_lower:
            if "finance" in prompt_lower:
                route = "finance"

        return AgentResponse(
            content=route,
            metadata={"system_prompt_used": SYSTEM_PROMPT}
        )
