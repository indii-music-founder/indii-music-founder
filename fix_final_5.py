import re

files = [
    'packages/renderer/src/modules/social/components/CreatePostModal.tsx',
    'packages/renderer/src/modules/touring/components/OnTheRoadTab.tsx',
    'packages/renderer/src/modules/touring/components/PlanningTab.tsx',
    'packages/renderer/src/modules/touring/RoadManager.tsx'
]

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    current_fn_start = -1
    for i, line in enumerate(lines):
        if re.search(r'(function|const) \w+\s*=?\s*\([^)]*\)\s*(=>)?\s*\{', line):
            current_fn_start = i
        if 't(' in line and current_fn_start != -1:
            # check if useTranslation is in scope for this function specifically
            has_t = False
            for j in range(current_fn_start, i):
                if 'useTranslation' in lines[j]:
                    has_t = True
                    break
            if not has_t:
                lines.insert(current_fn_start + 1, '    const { t } = useTranslation();')
                current_fn_start = -1 # prevent double inject
    with open(file, 'w') as f:
        f.write('\n'.join(lines))
        print(f"Fixed {file}")
