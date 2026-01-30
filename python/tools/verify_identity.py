import sys
sys.path.append('/a0')
import os
import asyncio
from google import genai
from python.config.ai_models import AIConfig

async def verify():
    print("🔍 Testing Google API Key Authentication...")
    try:
        api_key = AIConfig.get_api_key()
        print("✅ API Key Found in Environment.")
    except Exception as e:
        print(f"❌ API Key Config Error: {e}")
        return False

    try:
        client = genai.Client(api_key=api_key, http_options={'api_version': AIConfig.DEFAULT_API_VERSION})
        print("✅ Client Initialized.")
        
        # Simple call to verify validity
        print("📡 Pinging Gemini API (list_models)...")
        response = client.models.list()
        # Just verify we can fetch at least one
        count = 0
        for m in response:
            print(f"   - Found model: {m.name}")
            count += 1
            break
            
        if count > 0:
            print("✅ Identity Verification (API Key) PASSED.")
            return True
        else:
            print("⚠️ access confirmed but no models returned?")
            return True # Still success on auth
            
    except Exception as e:
        print(f"❌ API Call Failed: {e}")
        return False

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    success = loop.run_until_complete(verify())
    exit(0 if success else 1)
