import re

files = [
    'packages/renderer/src/modules/social/components/CreatePostModal.tsx',
    'packages/renderer/src/modules/social/components/ProductPickerModal.tsx',
    'packages/renderer/src/modules/social/components/SocialFeed.tsx',
    'packages/renderer/src/modules/touring/components/OnTheRoadTab.tsx',
    'packages/renderer/src/modules/touring/components/PlanningTab.tsx',
    'packages/renderer/src/modules/touring/RoadManager.tsx'
]

for file in files:
    with open(file, 'r') as f:
        content = f.read()

    # Find all components/functions that use t('...') but do NOT have const { t } = useTranslation();
    # We'll just look for functions that contain `placeholder={t(` and inject it
    lines = content.split('\n')
    current_fn_start = -1
    for i, line in enumerate(lines):
        if re.search(r'(function|const) \w+\s*=?\s*\([^)]*\)\s*(=>)?\s*\{', line) and not 'useTranslation' in line:
            current_fn_start = i
        if 'placeholder={t(' in line and current_fn_start != -1:
            # check if between current_fn_start and i we have useTranslation
            has_t = False
            for j in range(current_fn_start, i):
                if 'useTranslation' in lines[j]:
                    has_t = True
                    break
            if not has_t:
                # inject it at current_fn_start + 1
                lines.insert(current_fn_start + 1, '    const { t } = useTranslation();')
                current_fn_start = -1 # reset to avoid double injection

    with open(file, 'w') as f:
        f.write('\n'.join(lines))
        print(f"Checked {file}")
