import json
import glob
import os

print("=== Validation Report ===")
overall_total = 0
overall_expert = 0
errors = 0

for filepath in sorted(glob.glob('docs/agent-training/datasets/*.jsonl')):
    agent_name = os.path.basename(filepath).replace('.jsonl', '')
    agent_t = 0
    agent_e = 0
    
    with open(filepath) as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line: continue
            
            try:
                obj = json.loads(line)
                agent_t += 1
                if obj.get('difficulty') == 'expert':
                    agent_e += 1
            except json.JSONDecodeError as e:
                print(f"[{agent_name}] LINE {i} JSONError: {e}")
                errors += 1
                
    pct = (agent_e / agent_t * 100) if agent_t > 0 else 0
    icon = "✅" if pct >= 50.0 else "❌"
    
    print(f"{icon} {agent_name.capitalize():<14}: {agent_e}/{agent_t} = {pct:.1f}% expert")
    
    overall_total += agent_t
    overall_expert += agent_e

ov_pct = (overall_expert / overall_total * 100) if overall_total > 0 else 0
print(f"\\nOverall: {overall_expert}/{overall_total} = {ov_pct:.1f}%")
if errors:
    print(f"Errors found: {errors}")
else:
    print("All JSONL files are valid format.")
