import json
import os

def test_delegation_logic(prompt, registry_path):
    with open(registry_path, 'r') as f:
        registry = json.load(f)
        
    agents = registry.get("agents", registry)
    
    findings = []
    
    # Simulate a Conductor parsing the prompt and looking for specialists
    keywords = {
        "merch": ["margin", "sku", "product"],
        "music": ["split", "sheet", "track"],
        "social": ["tiktok", "post", "engagement"],
        "analytics": ["viral", "score", "trend"],
        "road": ["tour", "route", "logistics"],
        "legal": ["nda", "contract", "legal"]
    }
    
    for agent_name, agent_data in agents.items():
        skills = agent_data.get("skills", {})
        for skill_name, skill_data in skills.items():
            desc = skill_data.get("description", "").lower()
            labels = [l.lower() for l in skill_data.get("trigger_labels", [])]
            
            # Check if prompt matches any keywords or labels
            match_found = False
            for domain, keys in keywords.items():
                if domain in prompt.lower():
                    # If the prompt explicitly mentions the domain, look for it
                    if agent_name == domain:
                        match_found = True
                
                for key in keys:
                    if key in prompt.lower() and (key in desc or key in labels):
                        match_found = True
            
            if match_found:
                findings.append({
                    "agent": agent_name,
                    "skill": skill_name,
                    "tool_path": os.path.join(agent_data["path"], "skills", skill_name, "tools")
                })
                
    return findings

if __name__ == "__main__":
    prompt = "I'm launching a new vinyl line. Calculate the margin for a $30 price point, generate a split sheet for the producers, and format a TikTok post. Also check the viral potential."
    registry_path = "agents/capability_registry.json"
    
    print(f"Testing Prompt: {prompt}\n")
    results = test_delegation_logic(prompt, registry_path)
    
    if results:
        print(f"✅ Found {len(results)} potential specialists:")
        for res in results:
            print(f"- {res['agent']} (Skill: {res['skill']}) -> {res['tool_path']}")
    else:
        print("❌ No specialists found for this prompt.")
