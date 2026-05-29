const fs = require('fs');

const targets = {
    'packages/renderer/src/modules/publishing/components/MechanicalRoyaltyPanel.tsx': 'export function MechanicalRoyaltyPanel',
    'packages/renderer/src/modules/publishing/components/ReleaseWizard.tsx': 'export function ReleaseWizard',
    'packages/renderer/src/modules/social/components/AccountCreationWizard.tsx': 'export const AccountCreationWizard',
    'packages/renderer/src/modules/social/components/CreatePostModal.tsx': 'export const CreatePostModal',
    'packages/renderer/src/modules/social/components/ProductPickerModal.tsx': 'export const ProductPickerModal',
    'packages/renderer/src/modules/social/components/SocialFeed.tsx': 'export const SocialFeed',
    'packages/renderer/src/modules/touring/components/OnTheRoadTab.tsx': 'export function OnTheRoadTab',
    'packages/renderer/src/modules/touring/components/PlanningTab.tsx': 'export function PlanningTab',
    'packages/renderer/src/modules/touring/components/RoadMode.tsx': 'export const RoadMode',
    'packages/renderer/src/modules/touring/RoadManager.tsx': 'const RoadManager'
};

for (const [file, signature] of Object.entries(targets)) {
    let content = fs.readFileSync(file, 'utf8');
    let lines = content.split('\n');
    let injected = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(signature)) {
            // Find the first '{' on this line or subsequent lines
            let j = i;
            while (j < lines.length && !lines[j].includes('{')) {
                j++;
            }
            if (j < lines.length) {
                // To avoid double injecting, let's check if the next line already has it
                if (!lines[j+1].includes('useTranslation')) {
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
