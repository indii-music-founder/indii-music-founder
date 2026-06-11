import sys
import subprocess
import os

result = subprocess.run(['git', 'diff', '--name-only', 'origin/main...HEAD'], capture_output=True, text=True)
files = result.stdout.strip().split('\n')

for f in files:
    if f.endswith('.jsonl') and os.path.exists(f):
        with open(f, 'r', encoding='utf-8') as file:
            lines = file.readlines()
        
        new_lines = []
        for line in lines:
            if line.startswith('>>>>>>> origin/main'):
                continue
            if line.startswith('<<<<<<< HEAD'):
                continue
            if line.startswith('======='):
                continue
            new_lines.append(line)
            
        with open(f, 'w', encoding='utf-8') as file:
            file.writelines(new_lines)
        
        print(f"Cleaned {f}")

