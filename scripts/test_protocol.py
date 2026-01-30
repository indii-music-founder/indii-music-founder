import requests
import json
import time
import sys
import os

BASE_URL = "http://127.0.0.1:50080"

def test_image_protocol():
    print("🎨 Testing Image Protocol (Tooling Check)...")
    
    # Use the indii_image_gen tool via task
    instruction = "Generate an image of a 'cyberpunk sunset' and tell me the path to the saved file."
    
    payload = {
        "instruction": instruction
    }
    
    try:
        print("   Sending image generation task...")
        t0 = time.time()
        resp = requests.post(f"{BASE_URL}/indii_task", json=payload, timeout=300)
        duration = time.time() - t0
        
        if resp.status_code == 200:
            data = resp.json()
            agent_response = data.get("agent_response", "")
            print(f"   Status: {resp.status_code} ({duration:.2f}s)")
            print(f"   Agent Response: {agent_response}")
            
            # Check if an image was mentioned and if it looks like it was generated
            if "saved" in agent_response.lower() or ".png" in agent_response.lower() or ".jpg" in agent_response.lower():
                print("✅ Image generation seems to have triggered.")
                return True
            else:
                print("❌ No evidence of image generation in response.")
                return False
        else:
            print(f"❌ HTTP Error: {resp.status_code} - {resp.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    if test_image_protocol():
        print("\n✅ Test 7 (Protocol) PASSED")
    else:
        print("\n❌ Test 7 (Protocol) FAILED")
