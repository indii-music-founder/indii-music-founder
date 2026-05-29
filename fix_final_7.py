files = {
    'packages/renderer/src/modules/touring/components/OnTheRoadTab.tsx': [
        ('export const OnTheRoadTab: React.FC<OnTheRoadTabProps> = ({', 'export const OnTheRoadTab: React.FC<OnTheRoadTabProps> = ({\n')
    ],
    'packages/renderer/src/modules/touring/components/PlanningTab.tsx': [
        ('export const PlanningTab: React.FC<PlanningTabProps> = ({', 'export const PlanningTab: React.FC<PlanningTabProps> = ({\n')
    ]
}

for file, replacements in files.items():
    with open(file, 'r') as f:
        content = f.read()
    
    # We need to find the `=> {` corresponding to this and inject there
    idx = content.find('export const ')
    if idx != -1:
        brace_idx = content.find('=> {', idx)
        if brace_idx != -1:
            if 'const { t } = useTranslation();' not in content[brace_idx:brace_idx+100]:
                content = content[:brace_idx+4] + '\n    const { t } = useTranslation();' + content[brace_idx+4:]
                
    with open(file, 'w') as f:
        f.write(content)
        print(f"Fixed {file}")
