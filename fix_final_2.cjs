const fs = require('fs');
const files = [
    {
        name: 'packages/renderer/src/modules/social/components/CreatePostModal.tsx',
        regex: /(export const CreatePostModal: React\.FC<CreatePostModalProps> = \([^)]*\) => \{)/
    },
    {
        name: 'packages/renderer/src/modules/social/components/ProductPickerModal.tsx',
        regex: /(export const ProductPickerModal = \([^)]*\) => \{)/
    },
    {
        name: 'packages/renderer/src/modules/touring/components/OnTheRoadTab.tsx',
        regex: /(export function OnTheRoadTab\([^)]*\) \{)/
    },
    {
        name: 'packages/renderer/src/modules/touring/components/PlanningTab.tsx',
        regex: /(export function PlanningTab\([^)]*\) \{)/
    },
    {
        name: 'packages/renderer/src/modules/touring/RoadManager.tsx',
        regex: /(const RoadManager: React\.FC = \([^)]*\) => \{)/
    }
];

for (const {name, regex} of files) {
    let c = fs.readFileSync(name, 'utf8');
    if (!c.includes('useTranslation()')) {
        let match = c.match(regex);
        if (match) {
            c = c.replace(regex, match[1] + '\n    const { t } = useTranslation();');
            fs.writeFileSync(name, c);
            console.log(`Fixed ${name}`);
        } else {
            console.log(`Regex not matched in ${name}`);
        }
    } else {
        console.log(`Already has useTranslation() in ${name}`);
    }
}
