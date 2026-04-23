import json
from agent import AutoAgent

def test_conductor_routing():
    agent = AutoAgent("conductor")
    
    tasks = [
        {"goal": "I need to register an ISRC for my new track 'Summer Vibes'.", "expected": "music"},
        {"goal": "I need to see my royalty payments for last month.", "expected": "finance"},
        {"goal": "Can you review this contract for me?", "expected": "legal"},
        {"goal": "I want to start a marketing campaign for my album.", "expected": "marketing"},
    ]
    
    for task in tasks:
        print(f"\n--- Testing Task: {task['goal']} ---")
        res = agent.execute(task['goal'])
        print(f"Response: {res['response']}")
        
        # Check if tool was called
        tool_called = "[Tool: delegate_task]" in res['response']
        print(f"Tool Called: {tool_called}")
        if tool_called:
            # Check if it routed to the right agent
            if task['expected'] in res['response'].lower():
                print(f"SUCCESS: Correctly routed to {task['expected']}")
            else:
                print(f"FAILURE: Routed to wrong agent. Expected {task['expected']}")
        else:
            print("FAILURE: No tool call detected.")

if __name__ == "__main__":
    test_conductor_routing()
