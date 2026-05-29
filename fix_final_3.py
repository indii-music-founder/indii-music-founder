import re

files = {
    'packages/renderer/src/modules/social/components/CreatePostModal.tsx': 'export const CreatePostModal',
    'packages/renderer/src/modules/social/components/ProductPickerModal.tsx': 'export const ProductPickerModal',
    'packages/renderer/src/modules/touring/components/OnTheRoadTab.tsx': 'export function OnTheRoadTab',
    'packages/renderer/src/modules/touring/components/PlanningTab.tsx': 'export function PlanningTab'
}

for file, sig in files.items():
    with open(file, 'r') as f:
        content = f.read()
    
    if 'const { t } = useTranslation();' not in content:
        # find `sig` and then the first `{` after it.
        idx = content.find(sig)
        if idx != -1:
            brace_idx = content.find('{', idx)
            if brace_idx != -1:
                # Insert const { t }
                new_content = content[:brace_idx+1] + '\n    const { t } = useTranslation();' + content[brace_idx+1:]
                with open(file, 'w') as f:
                    f.write(new_content)
                print(f"Fixed {file}")
