files = {
    'packages/renderer/src/modules/touring/components/OnTheRoadTab.tsx': [
        ('export function OnTheRoadTab({ state, onUpdate }: Props) {', 'export function OnTheRoadTab({ state, onUpdate }: Props) {\n    const { t } = useTranslation();')
    ],
    'packages/renderer/src/modules/touring/components/PlanningTab.tsx': [
        ('export function PlanningTab({ state, onUpdate }: Props) {', 'export function PlanningTab({ state, onUpdate }: Props) {\n    const { t } = useTranslation();')
    ],
    'packages/renderer/src/modules/touring/RoadManager.tsx': [
        ('function EmergencyContactsPanel({ contacts, onSave, onDelete }: EmergencyContactsPanelProps) {', 'function EmergencyContactsPanel({ contacts, onSave, onDelete }: EmergencyContactsPanelProps) {\n    const { t } = useTranslation();')
    ]
}

for file, replacements in files.items():
    with open(file, 'r') as f:
        content = f.read()
    for search, replace in replacements:
        if replace not in content:
            content = content.replace(search, replace)
    with open(file, 'w') as f:
        f.write(content)
        print(f"Fixed {file}")
