import os
import json
from pathlib import Path
from typing import Dict, Any, Optional
from google import genai
from google.genai import types
from dotenv import load_dotenv

# The following variable is targeted by the AutoAgent optimization loop.
# Do not rename. The Meta-Agent will overwrite this string literal.
SYSTEM_PROMPT: Optional[str] = None

class AutoAgent:
    """
    Wrapper for indiiOS agents during optimization.
    Proxies calls to the Gemini API using actual system prompts from the codebase.
    """
    
    def __init__(self, agent_id: str, model_id: str = "gemini-3-pro-preview"):
        self.agent_id = agent_id
        self.model_id = model_id
        
        # Load environment variables
        load_dotenv()
        self.api_key = os.getenv("VITE_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("VITE_API_KEY or GOOGLE_API_KEY not found in environment.")
            
        self.client = genai.Client(api_key=self.api_key)
        self.project_root = self._find_project_root()
        
        # Priority: 1. Top-level SYSTEM_PROMPT (from optimizer), 2. Load from disk
        if SYSTEM_PROMPT:
            print(f"Using optimized SYSTEM_PROMPT for {self.agent_id}")
            self.system_prompt = SYSTEM_PROMPT
        else:
            self.system_prompt = self._load_system_prompt()

    def _find_project_root(self) -> Path:
        """Finds the root directory of the indiiOS-Clean project."""
        current = Path(__file__).resolve()
        for parent in current.parents:
            if (parent / "package.json").exists() or (parent / "GEMINI.md").exists():
                return parent
        return current.parents[2] # Fallback

    def _load_system_prompt(self) -> str:
        """Loads the system prompt for the specified agent."""
        folder_map = {
            "generalist": "agent0",
            "conductor": "agent0",
            "brand": "brand",
            "road": "road",
            "publicist": "publicist",
            "marketing": "marketing",
            "social": "social",
            "legal": "legal",
            "publishing": "publishing",
            "finance": "finance",
            "licensing": "licensing",
            "distribution": "distribution",
            "music": "music",
            "video": "video",
            "security": "security",
            "producer": "producer",
            "director": "creative-director",
            "creative-director": "creative-director",
            "merchandise": "merchandise",
        }
        
        folder = folder_map.get(self.agent_id, self.agent_id)
        agents_dir = self.project_root / "agents" / folder
        
        candidates = [
            agents_dir / "prompt.md",
            agents_dir / "prompts" / "agent.system.main.role.md",
            agents_dir / "AGENTS.md",
            agents_dir / "agent.system.md",
        ]
        
        for path in candidates:
            if path.exists():
                print(f"Loading system prompt from: {path}")
                return path.read_text(encoding="utf-8")
                
        print(f"Warning: No system prompt found for {self.agent_id}, using fallback.")
        return f"You are the {self.agent_id} specialist agent within the indiiOS creative platform."

    def execute(self, user_goal: str, history: Optional[list] = None) -> Dict[str, Any]:
        """
        Executes a task using the agent's system prompt and the user's goal.
        """
        print(f"Executing {self.agent_id} ({self.model_id}) with goal: {user_goal}")
        
        try:
            # Define tools for the agent
            def delegate_task(targetAgentId: str, task: str, sharedContext: str = None):
                """Routes a task to a specialized Spoke agent."""
                return f"Delegated {task} to {targetAgentId}"

            def synthesize_plan(goal: str):
                """Creates a multi-agent roadmap for a complex goal."""
                return f"Synthesized plan for {goal}"

            tools = [delegate_task, synthesize_plan]

            response = self.client.models.generate_content(
                model=self.model_id,
                contents=user_goal,
                config=types.GenerateContentConfig(
                    system_instruction=self.system_prompt,
                    tools=tools,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                    temperature=1.0,
                    max_output_tokens=4096,
                )
            )
            
            print(f"DEBUG: Response Object: {response}")
            
            # Extract text and tool calls from all parts
            response_text = ""
            if response.candidates and len(response.candidates) > 0:
                parts = response.candidates[0].content.parts
                if parts:
                    for i, part in enumerate(parts):
                        print(f"DEBUG: Part {i}: {part}")
                        if part.text:
                            response_text += part.text + "\n"
                        if part.function_call:
                            print(f"DEBUG: Detected function call: {part.function_call.name}")
                            # If it's a function call, serialize it so the evaluator can check for it
                            call_dict = {
                                "name": part.function_call.name,
                                "args": part.function_call.args
                            }
                            # Formatting for the evaluator (making it look like a tool call)
                            response_text += f"[Tool: {part.function_call.name}] Arguments: {json.dumps(call_dict['args'])}\n"
            
            # Fallback to response.text if parts failed for some reason
            if not response_text and response.text:
                print("DEBUG: Falling back to response.text")
                response_text = response.text

            result = {
                "status": "success",
                "response": response_text.strip() if response_text else None,
                "usage": {
                    "prompt_tokens": response.usage_metadata.prompt_token_count if response.usage_metadata else 0,
                    "candidates_tokens": response.usage_metadata.candidates_token_count if response.usage_metadata else 0,
                    "total_tokens": response.usage_metadata.total_token_count if response.usage_metadata else 0,
                }
            }
            
            # Log the result for the evaluator
            self._log_trace(user_goal, result)
            
            return result
        except Exception as e:
            print(f"Error during execution: {e}")
            import traceback
            traceback.print_exc()
            return {"status": "error", "error": str(e)}

    def _log_trace(self, goal: str, result: Dict[str, Any]):
        """Logs the execution trace to a file for later analysis."""
        trace_dir = Path("jobs")
        trace_dir.mkdir(exist_ok=True)
        
        trace_file = trace_dir / f"{self.agent_id}_trace.json"
        
        trace_data = {
            "agent_id": self.agent_id,
            "model_id": self.model_id,
            "goal": goal,
            "result": result,
            "timestamp": "2026-04-22T18:51:00Z" # Mock timestamp for now
        }
        
        # Append or create
        traces = []
        if trace_file.exists():
            try:
                traces = json.loads(trace_file.read_text())
            except Exception as e:
                print(f"Warning: Failed to load existing traces from {trace_file}: {e}")
        
        traces.append(trace_data)
        trace_file.write_text(json.dumps(traces, indent=2))

if __name__ == "__main__":
    # Check for TASK_ID environment variable
    task_id = os.getenv("TASK_ID")
    agent_id = os.getenv("AGENT_ID", "conductor")
    
    if task_id:
        task_dir = Path("tasks") / task_id
        instruction_file = task_dir / "instruction.md"
        if instruction_file.exists():
            goal = instruction_file.read_text(encoding="utf-8")
        else:
            goal = f"Execute task: {task_id}"
    else:
        # Fallback for manual testing
        goal = "I need to register an ISRC for my new track 'Summer Vibes'."
        
    agent = AutoAgent(agent_id)
    res = agent.execute(goal)
    print(json.dumps(res, indent=2))
