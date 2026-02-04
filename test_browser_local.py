import asyncio
import sys
import os

# Ensure we can import from the python directory
sys.path.append(os.path.abspath("indiiOS-Alpha-Electron"))

from python.tools.browser_tool import BrowserTool

class MockAgent:
    def __init__(self):
        self.context = {}

async def test_browser():
    print("Initializing Mock Agent...")
    agent = MockAgent()
    tool = BrowserTool(agent)
    
    print("1. Opening google.com...")
    resp = await tool.execute('open', url='https://google.com')
    print(f"Response: {resp.message}")
    
    print("2. Getting DOM (to extract title)...")
    dom_resp = await tool.execute('get_dom')
    # Simple extraction since we don't have bs4 in this script context easily
    if "<title>Google</title>" in dom_resp.message or "Google" in dom_resp.message:
        print("SUCCESS: Found 'Google' in DOM.")
    else:
        print(f"WARNING: Title not immediately obvious in DOM snippet (len {len(dom_resp.message)})")
        
    print("3. Closing Browser...")
    await tool.execute('close')
    print("Test Complete.")

if __name__ == "__main__":
    asyncio.run(test_browser())
