files = {
    'packages/renderer/src/modules/touring/RoadManager.tsx': [40, 49, 215, 264, 286],
    'packages/renderer/src/modules/touring/components/OnTheRoadTab.tsx': [56]
}

for file, lines_to_remove in files.items():
    with open(file, 'r') as f:
        lines = f.read().split('\n')
    
    # zero-indexed
    indices = [l - 1 for l in lines_to_remove]
    
    new_lines = []
    for i, line in enumerate(lines):
        if i not in indices:
            new_lines.append(line)
        else:
            print(f"Removing line {i+1} from {file}: {line}")
            
    with open(file, 'w') as f:
        f.write('\n'.join(new_lines))
