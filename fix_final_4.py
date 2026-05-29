import re

files = {
    'packages/renderer/src/modules/social/components/CreatePostModal.tsx': r'export const CreatePostModal: React\.FC<CreatePostModalProps> = \(\{([^}]+)\}\) => \{',
    'packages/renderer/src/modules/social/components/ProductPickerModal.tsx': r'export const ProductPickerModal: React\.FC<ProductPickerModalProps> = \(\{([^}]+)\}\) => \{',
    'packages/renderer/src/modules/touring/components/OnTheRoadTab.tsx': r'export function OnTheRoadTab\(\{([^}]+)\}: Props\) \{',
    'packages/renderer/src/modules/touring/components/PlanningTab.tsx': r'export function PlanningTab\(\{([^}]+)\}: Props\) \{'
}

for file, pattern in files.items():
    with open(file, 'r') as f:
        content = f.read()
    
    if 'const { t } = useTranslation();' not in content:
        def replacer(match):
            return match.group(0) + '\n    const { t } = useTranslation();'
        
        new_content = re.sub(pattern, replacer, content)
        with open(file, 'w') as f:
            f.write(new_content)
        print(f"Fixed {file}")
