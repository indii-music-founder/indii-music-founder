import os
import asyncio
import time
from dotenv import load_dotenv

# Load env vars
load_dotenv(".env")
from google import genai
from google.genai import types

async def main():
    api_key = os.environ.get("GOOGLE_API_KEY")
    client = genai.Client(api_key=api_key)
    model_id = "veo-3.1-generate-preview"
    
    prompt = "A breathtaking cinematic wide shot of a neon cyberpunk city at night with flying cars, 4k resolution."
    print("Starting generation...")
    operation = client.models.generate_videos(
        model=model_id,
        prompt=prompt,
        config=types.GenerateVideosConfig(duration_seconds=4)
    )
    
    print("Initial operation attributes:")
    print(f"Name: {getattr(operation, 'name', None)}")
    print(f"Done: {getattr(operation, 'done', None)}")
    
    # Try polling
    while not operation.done:
        print("Polling... waiting 10 seconds")
        time.sleep(10)
        # Try both ways to get the updated operation
        try:
            op_name = operation.name
            operation = client.operations.get(operation=operation)
        except Exception as e:
            print(f"Error getting operation: {e}")
            break
            
        print(f"Status - Done: {getattr(operation, 'done', None)}")
        
    print("Operation done!")
    if getattr(operation, 'error', None):
        print("Error:", operation.error)
    else:
        # Check generated_videos
        response = getattr(operation, 'response', None)
        if response:
            print("Has generated_videos?", hasattr(response, 'generated_videos'))
            if hasattr(response, 'generated_videos'):
                print("Number of videos:", len(response.generated_videos))

if __name__ == "__main__":
    asyncio.run(main())
