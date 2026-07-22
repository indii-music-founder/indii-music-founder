import time
import json
import subprocess
import os
import re

CONFIG_PATH = ".agent/test_ledger/departments_test_config.json"
ISSUES_PATH = ".agent/test_ledger/OPEN_ISSUES_V2.md"
GSTACK_BIN = os.path.expanduser("~/.claude/skills/gstack/browse/dist/browse")
PORT = "4243"

def get_next_issue_id():
    if not os.path.exists(ISSUES_PATH):
        return 1
    with open(ISSUES_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    # Find all ISSUE-MEGA-[ID]
    matches = re.findall(r'### ISSUE-MEGA-(\d+):', content)
    if matches:
        return max([int(m) for m in matches]) + 1
    
    # Check general ISSUE-[ID]
    matches_all = re.findall(r'### ISSUE-[A-Z]+-(\d+):', content)
    matches_simple = re.findall(r'### ISSUE-(\d+):', content)
    max_id = 1
    if matches_all:
        max_id = max(max_id, max([int(m) for m in matches_all]))
    if matches_simple:
        max_id = max(max_id, max([int(m) for m in matches_simple]))
    return max_id + 1

def append_issue(issue_id, title, severity, module, summary, fix_direction):
    issue_text = f"\n### ISSUE-MEGA-{issue_id}: {title}\n"
    issue_text += f"- **Status:** OPEN\n"
    issue_text += f"- **Severity:** {severity}\n"
    issue_text += f"- **Module:** {module}\n"
    issue_text += f"- **Summary:** {summary}\n"
    issue_text += f"- **Fix Direction:** {fix_direction}\n"
    
    with open(ISSUES_PATH, "a", encoding="utf-8") as f:
        f.write(issue_text)

def run_browser_gauntlet(target_key, target_name):
    # Navigate using gstack
    url = f"http://localhost:{PORT}/{target_key}"
    print(f"Observing {url} ...")
    
    # We will use gstack chain to goto, wait, get text, get console
    chain_cmds = [
        ["goto", url],
        ["wait", "--networkidle"],
        ["text"],
        ["console", "--errors"]
    ]
    chain_json = json.dumps(chain_cmds)
    
    try:
        proc = subprocess.run([GSTACK_BIN, "chain"], input=chain_json, capture_output=True, text=True, timeout=60)
        output = proc.stdout + proc.stderr
    except Exception as e:
        output = str(e)
    
    issues_found = []
    
    # Check output for console errors
    # Ignore false positives like network warnings if possible, but keep it simple
    if "Error:" in output or "Exception:" in output or "TypeError" in output:
        if "Failed to load resource: the server responded with a status of 404" in output:
             issues_found.append(("404 Error on page", "Medium", f"Resource missing on {url}", "Check missing resources."))
        else:
             issues_found.append(("Console Error Detected", "High", f"Console errors observed on {url}:\n```text\n{output[:300]}...\n```", "Investigate console logs."))
    
    # Check text for visual issues
    if "undefined" in output.lower():
        issues_found.append(("Visual Issue: 'undefined' rendered", "Low", f"The word 'undefined' was found rendered on {url}.", "Ensure variables are initialized before rendering."))
    if "[object object]" in output.lower():
        issues_found.append(("Visual Issue: '[object Object]' rendered", "Low", f"Raw object rendered on {url}.", "Stringify or render object properties correctly."))
        
    return issues_found

def main():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)
        
    ordered_keys = [
        "brand", "road", "campaign", "agent", "publicist", "creative",
        "marketing", "social", "legal", "publishing", "finance", "distribution",
        "licensing", "merch", "registration", "security",
        "workflow", "audio-analyzer", "knowledge", "memory", "observability", "settings",
        "mobile-remote", "dashboard", "boardroom", "founders", "onboarding"
    ]
    test_sequence = [key for key in ordered_keys if key in config]
    for key in config:
        if key not in test_sequence:
            test_sequence.append(key)
            
    print("Starting Infinite Mega Loop...")
    cycle = 1
    for _ in range(1):
        print(f"--- Cycle {cycle} ---")
        for key in test_sequence:
            name = config[key].get("name", key)
            print(f"Testing {name} ({key})")
            
            # 1. Run scoped test runner
            subprocess.run(["python3", "execution/run_department_test.py", key])
            
            # 2. Browser observation
            issues = run_browser_gauntlet(key, name)
            
            # Log issues
            for title, severity, summary, fix_dir in issues:
                issue_id = get_next_issue_id()
                print(f"Found Issue: {title} (ID: {issue_id})")
                append_issue(issue_id, title, severity, name, summary, fix_dir)
                
        cycle += 1
        time.sleep(5)

if __name__ == "__main__":
    main()
