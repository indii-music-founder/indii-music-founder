import os
import asyncio
from dotenv import load_dotenv

# Load env vars
load_dotenv(".env")

from python.tools.indii_video_gen import IndiiVideoGen

async def main():
    prompt = "Cinematic 4K hyper-detailed wide shot of a futuristic cyberpunk city with flying neon cars zooming past the camera, neon lights reflecting in puddles on the street, volumetric fog, Unreal Engine 5 render style."
    print(f"Generating video for prompt: '{prompt}'")
    
    tool = IndiiVideoGen()
    
    # Mock agent context to dictate the output directory
    class MockContext:
        id = "cyberpunk_demo"
    class MockAgent:
        context = MockContext()
        
    tool.agent = MockAgent()
    
    try:
        response = await tool.execute(prompt=prompt, duration=4)
        print("\n--- Generation Complete ---")
        print("Message:")
        print(response.message)
        print("\nAdditional Data:")
        print(response.additional)
    except Exception as e:
        print(f"Error executing video gen context: {e}")

if __name__ == "__main__":
    asyncio.run(main())
