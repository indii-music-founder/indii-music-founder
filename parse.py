import os
import json
import re

with open('placeholders.txt') as f:
    lines = f.read().splitlines()

lines = [l for l in lines if ':' in l and l.startswith('packages/')]

data = {}
for line in lines:
    parts = line.split(':', 2)
    file = parts[0]
    line_num = parts[1]
    text = parts[2]
    match = re.search(r'placeholder="([^"]+)"', text)
    if match:
        placeholder_text = match.group(1)
        if file not in data:
            data[file] = []
        data[file].append((line_num, placeholder_text))

with open('parsed_placeholders.json', 'w') as f:
    json.dump(data, f, indent=2)
