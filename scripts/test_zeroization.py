import requests
import json
import time
import sys

BASE_URL = "http://127.0.0.1:50080"

def test_zeroization():
    print("🧹 Testing Zeroization (Secrets Hygiene Check)...")
    
    # 1. Generate Opaque Handle
    print("   1. Generating opaque handle for 'google_api'...")
    resp = requests.post(f"{BASE_URL}/auth_broker", json={
        "action": "generate_handle",
        "secret_id": "google_api"
    })
    
    if resp.status_code != 200:
        print(f"❌ Failed to generate handle: {resp.status_code}")
        return False
        
    data = resp.json()
    handle = data.get("handle")
    if not handle:
        print(f"❌ No handle returned: {data}")
        return False
        
    print(f"   Handle generated: {handle}")
    
    # 2. Resolve Handle
    print("   2. Resolving handle to verify secret...")
    resp = requests.post(f"{BASE_URL}/auth_broker", json={
        "action": "resolve_handle",
        "handle": handle
    })
    
    if resp.status_code != 200:
        print(f"❌ Failed to resolve handle: {resp.status_code}")
        return False
        
    data = resp.json()
    secret = data.get("secret")
    if not secret:
        print(f"❌ Resolving failed: {data}")
        return False
    print("   Secret resolved successfully (hidden for security).")
    
    # 3. Zeroize Session
    print("   3. Calling zeroize_session...")
    resp = requests.post(f"{BASE_URL}/auth_broker", json={
        "action": "zeroize_session",
        "instruction": "Test 8 Verification"
    })
    
    if resp.status_code != 200:
        print(f"❌ Failed to zeroize: {resp.status_code}")
        return False
    
    # 4. Attempt Resolve after Zeroization
    print("   4. Attempting to resolve handle after zeroization...")
    resp = requests.post(f"{BASE_URL}/auth_broker", json={
        "action": "resolve_handle",
        "handle": handle
    })
    
    # This should fail
    data = resp.json()
    if data.get("error") == "Invalid or unknown handle":
        print("✅ Correct: Handle was successfully zeroized.")
        return True
    else:
        print(f"❌ Error: Handle still exists after zeroization! {data}")
        return False

if __name__ == "__main__":
    if test_zeroization():
        print("\n✅ Test 8 (Zeroization) PASSED")
        sys.exit(0)
    else:
        print("\n❌ Test 8 (Zeroization) FAILED")
        sys.exit(1)
