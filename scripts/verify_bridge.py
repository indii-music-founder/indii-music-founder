import requests
import json
import time
import sys

BASE_URL = "http://127.0.0.1:50080"

def test_health():
    print("🏥 Testing Health Endpoint (/login)...")
    try:
        resp = requests.get(f"{BASE_URL}/login", timeout=5)
        print(f"   Status: {resp.status_code}")
        # 200 OK for login page is expected
        if resp.status_code == 200:
            print(f"   Response Preview: {resp.text[:50]}...")
            return True
        elif resp.status_code == 404:
             print("   404 (Server Up but path missing) - Accepted for connectivity check.")
             return True
        else:
            print(f"❌ Failed: {resp.status_code}")
            return False
    except requests.exceptions.ReadTimeout:
        print("❌ Timeout")
        return False
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return False

def test_headless_task():
    print("\n🤖 Testing Headless Task (/indii_task)...")
    payload = {
        "instruction": "Explain the concept of 'Zero Trust' in one sentence."
    }
    try:
        t0 = time.time()
        # endpoint based on filename indii_task.py -> /indii_task
        resp = requests.post(f"{BASE_URL}/indii_task", json=payload, timeout=30)
        duration = time.time() - t0
        
        print(f"   Status: {resp.status_code} ({duration:.2f}s)")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "success":
                print(f"✅ Success!")
                print(f"   Agent Response: {data.get('agent_response')}")
                return True
            else:
                print(f"❌ Application Error: {data}")
                return False
        else:
            print(f"❌ HTTP Error: {resp.text}")
            return False
            
    except requests.exceptions.ReadTimeout:
        print("❌ Timeout (Agent took too long)")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print(f"🔌 Sidecar Bridge Verification (Target: {BASE_URL})")
    
    # Retry loop for slow startup
    max_retries = 20
    for i in range(max_retries):
        if test_health():
            break
        print(f"⏳ Waiting for server... ({i+1}/{max_retries})")
        time.sleep(5)
    else:
        print("❌ Aborting: Health check failed after retries.")
        sys.exit(1)
        
    if test_headless_task():
        print("\n✅ Test 5 (Headless Command) PASSED")
        sys.exit(0)
    else:
        print("\n❌ Test 5 FAILED")
        sys.exit(1)
