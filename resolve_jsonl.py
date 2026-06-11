import sys
import subprocess
import os

def resolve_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    for line in lines:
        if line.startswith('<<<<<<< HEAD') or line.startswith('=======') or line.startswith('>>>>>>> claude/'):
            continue
        new_lines.append(line)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    subprocess.run(['git', 'add', filepath], check=True)
    print(f"Resolved {filepath}")

# Get all conflicted files
result = subprocess.run(['git', 'diff', '--name-only', '--diff-filter=U'], capture_output=True, text=True)
files = result.stdout.strip().split('\n')

for f in files:
    if f.endswith('.jsonl') and os.path.exists(f):
        resolve_file(f)

print("Done resolving jsonl files.")
