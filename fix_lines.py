import os

fixes = {
    'packages/renderer/src/modules/social/components/CreatePostModal.tsx': [156],
    'packages/renderer/src/modules/social/components/ProductPickerModal.tsx': [83],
    'packages/renderer/src/modules/touring/components/OnTheRoadTab.tsx': [258],
    'packages/renderer/src/modules/touring/components/PlanningTab.tsx': [100],
    'packages/renderer/src/modules/touring/RoadManager.tsx': [98, 106]
}

for file, error_lines in fixes.items():
    with open(file, 'r') as f:
        lines = f.read().split('\n')
    
    # Iterate backwards so insertions don't change line numbers we care about
    for ln in sorted(error_lines, reverse=True):
        idx = ln - 1 # 0-indexed
        
        # look backwards from idx to find the nearest function or component declaration, or simply insert right before the statement
        # Actually we can just find the nearest `{` going up and insert it after.
        # But wait, it's safer to just look backwards for the start of the function body.
        # Let's just insert it right before the JSX that uses it.
        # It's an arrow function rendering JSX? Let's just look for `return (` or `return <` or `=> (` 
        # and insert `const { t } = useTranslation();` inside? If it's `() => (<div...>)` we have to change it to `() => { const { t } = useTranslation(); return (<div...>); }`. That's too hard.
        
        # Let's just search up for `const ... = () => {` or `function ... {`
        for i in range(idx, -1, -1):
            if '{' in lines[i]:
                lines[i] = lines[i].replace('{', '{\n    const { t } = useTranslation();', 1)
                break

    with open(file, 'w') as f:
        f.write('\n'.join(lines))
        print(f"Fixed {file}")
