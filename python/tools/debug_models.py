import os
from google import genai

# Get API Key
api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
if not api_key:
    print("Error: No API Key found.")
    exit(1)

print(f"Using API Key: {api_key[:5]}...")

# Initialize Client (v1alpha)
client = genai.Client(api_key=api_key, http_options={'api_version': 'v1alpha'})

print("\n--- Listing Models (v1alpha) ---")
try:
    pager = client.models.list()
    found_any = False
    for model in pager:
        found_any = True
        # Filter for likely image/video models
        if "image" in model.name.lower() or "video" in model.name.lower() or "veo" in model.name.lower():
            print(f"FOUND RELEVANT: {model.name}")
            print(f"  DisplayName: {model.display_name}")
        else:
            # Print a few others just to prove connection
            if "gemini-3" in model.name:
                print(f"FOUND GEMINI: {model.name}")
            
    if not found_any:
        print("No models returned by list().")

except Exception as e:
    print(f"Error listing models: {e}")
