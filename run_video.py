import asyncio
import os
import sys

def load_env():
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")
load_env()

# Ensure we have the api key
api_key = os.environ.get("VITE_API_KEY")
if api_key:
    os.environ["GOOGLE_API_KEY"] = api_key
    os.environ["GEMINI_API_KEY"] = api_key
else:
    print("No VITE_API_KEY found in .env")
    sys.exit(1)

from python.tools.indii_video_gen import IndiiVideoGen

class DummyContext:
    id = "admin_workspace"

class DummyAgent:
    context = DummyContext()

async def main():
    print("Starting direct video generation via Veo 3.1...")
    tool = IndiiVideoGen()
    tool.agent = DummyAgent()
    
    # We monkey-patch set_progress to print to stdout so we see updates
    def set_progress(msg):
        print(f"PROGRESS: {msg}")
    tool.set_progress = set_progress

    res = await tool.execute(
        prompt="A cinematic drone shot flying over a glowing neon cyberpunk city at night, 4k, hyperrealistic",
        duration=4
    )
    
    print("\n--- GENERATION RESULT ---")
    print(res.message)
    if hasattr(res, "additional") and res.additional:
        print(f"\nAdditional Data: {res.additional}")

asyncio.run(main())
