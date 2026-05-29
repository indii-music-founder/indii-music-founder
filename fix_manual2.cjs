const fs = require('fs');

const targets = {
    'packages/renderer/src/modules/publishing/components/MechanicalRoyaltyPanel.tsx': 'export function MechanicalRoyaltyPanel',
    'packages/renderer/src/modules/publishing/components/ReleaseWizard.tsx': 'export default function ReleaseWizard',
    'packages/renderer/src/modules/social/components/AccountCreationWizard.tsx': 'export const AccountCreationWizard',
    'packages/renderer/src/modules/social/components/CreatePostModal.tsx': 'export const CreatePostModal',
    'packages/renderer/src/modules/social/components/SocialFeed.tsx': 'export const SocialFeed',
    'packages/renderer/src/modules/touring/components/OnTheRoadTab.tsx': 'export function OnTheRoadTab',
    'packages/renderer/src/modules/touring/components/PlanningTab.tsx': 'export function PlanningTab',
    'packages/renderer/src/modules/touring/RoadManager.tsx': 'const RoadManager: React.FC = () => {'
};

for (const [file, signature] of Object.entries(targets)) {
    let content = fs.readFileSync(file, 'utf8');
    let lines = content.split('\n');
    let injected = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(signature)) {
            let j = i;
            while (j < lines.length && !lines[j].includes('{')) {
                j++;
            }
            if (j < lines.length) {
                // Remove previous incorrect injection if there is one on the next line? Actually we just inject it correctly
                // Check if already injected within next 3 lines
                let already = false;
                for(let k=j; k<j+4 && k<lines.length; k++) {
                    if (lines[k].includes('useTranslation()')) already = true;
                }
                if (!already) {
                    lines[j] = lines[j].replace('{', '{\n    const { t } = useTranslation();');
                    injected = true;
                }
                break;
            }
        }
    }
    if (injected) {
        fs.writeFileSync(file, lines.join('\n'));
        console.log('Fixed ' + file);
    } else {
        console.log('Already fixed or not found ' + file);
    }
}
