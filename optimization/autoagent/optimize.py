import os
import json
import subprocess
from pathlib import Path
from google import genai
from google.genai import types
from dotenv import load_dotenv

class AutoOptimizer:
    def __init__(self, agent_id: str, task_id: str):
        self.agent_id = agent_id
        self.task_id = task_id
        load_dotenv()
        self.api_key = os.getenv("VITE_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.client = genai.Client(api_key=self.api_key)
        self.project_root = self._find_project_root()
        
    def _find_project_root(self) -> Path:
        current = Path(__file__).resolve()
        for parent in current.parents:
            if (parent / "package.json").exists() or (parent / "GEMINI.md").exists():
                return parent
        return current.parents[2]

    def run_cycle(self):
        print(f"--- Starting Optimization Cycle for {self.agent_id} on {self.task_id} ---")
        
        # 1. Get current state
        agent_path = self._get_agent_prompt_path()
        current_prompt = agent_path.read_text(encoding="utf-8")
        
        task_dir = Path(f"tasks/{self.task_id}")
        instruction = (task_dir / "instruction.md").read_text(encoding="utf-8")
        
        # 2. Run current agent
        print(f"Running agent for {self.task_id}...")
        # We pass the task_id via environment variables
        env = os.environ.copy()
        env["TASK_ID"] = self.task_id
        env["AGENT_ID"] = self.agent_id
        
        exec_cmd = ["uv", "run", "python", "agent.py"]
        subprocess.run(exec_cmd, env=env, check=True)
        
        # 3. Run tests
        print("Running tests...")
        test_script = task_dir / "tests" / "test.py"
        test_result = subprocess.run(["python3", str(test_script)], capture_output=True, text=True)
        
        if test_result.returncode == 0:
            print("SUCCESS: Tests passed already!")
            return
            
        print("FAILURE detected. Analyzing...")
        error_msg = test_result.stdout + test_result.stderr
        print(f"Error: {error_msg}")
        
        # 4. Prompt for optimization
        print("Consulting Meta-Agent for optimization...")
        optimized_prompt = self._get_optimized_prompt(current_prompt, instruction, error_msg)
        
        # 5. Apply optimization
        print(f"Applying optimization to {agent_path}")
        agent_path.write_text(optimized_prompt, encoding="utf-8")
        
        # 6. Verify
        print("Verifying optimization...")
        subprocess.run(exec_cmd, check=True)
        final_test = subprocess.run(["python3", str(test_script)], capture_output=True, text=True)
        
        if final_test.returncode == 0:
            print("🏆 OPTIMIZATION SUCCESSFUL!")
        else:
            print("❌ Optimization failed to pass tests.")
            print(final_test.stdout)

    def _get_agent_prompt_path(self) -> Path:
        folder_map = {"conductor": "agent0", "agent0": "agent0"}
        folder = folder_map.get(self.agent_id, self.agent_id)
        return self.project_root / "agents" / folder / "prompt.md"

    def _get_optimized_prompt(self, current_prompt: str, instruction: str, error: str) -> str:
        prompt = f"""
You are the indiiOS Meta-Agent. Your goal is to optimize a specialist agent's SYSTEM_PROMPT.

CURRENT SYSTEM_PROMPT:
---
{current_prompt}
---

TASK INSTRUCTION:
---
{instruction}
---

TEST FAILURE:
---
{error}
---

### CRITICAL KNOWLEDGE:
- The primary tool for delegation in the Conductor is `delegate_task(targetAgentId: string, task: string)`.
- Many routing failures occur because the agent forgets that 'ISRC' and 'Music Metadata' belong to the **Music** agent, not Publishing.
- The agent should always produce a tool call or a natural language description of the delegation when prompted.
- Ensure all example tool calls use the correct signature: `delegate_task({{ targetAgentId: "agent_id", task: "..." }})`.

### INSTRUCTIONS:
1. Identify why the agent failed based on the TEST FAILURE and TASK INSTRUCTION.
2. Modify the SYSTEM_PROMPT to fix the issue.
3. Maintain the agent's core personality and format (MISSION, ARCHITECTURE, SECURITY PROTOCOL).
4. Output ONLY the full, new SYSTEM_PROMPT. No explanation, no markdown blocks outside the prompt itself.
"""
        response = self.client.models.generate_content(
            model="gemini-3-pro-preview",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.0, # High factuality for RAG/Optimization
            )
        )
        return response.text.strip()

if __name__ == "__main__":
    import sys
    
    agent_id = sys.argv[1] if len(sys.argv) > 1 else "conductor"
    task_id = sys.argv[2] if len(sys.argv) > 2 else "routing-isrc"
    
    optimizer = AutoOptimizer(agent_id, task_id)
    optimizer.run_cycle()
