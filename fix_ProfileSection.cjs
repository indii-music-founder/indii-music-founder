const fs = require('fs');

let c = fs.readFileSync('packages/renderer/src/modules/settings/settings-panel/ProfileSection.tsx', 'utf8');
if(!c.includes('const { t } = useTranslation();')) {
    c = c.replace('const ProfileSection: React.FC = () => {', 'const ProfileSection: React.FC = () => {\n    const { t } = useTranslation();');
    fs.writeFileSync('packages/renderer/src/modules/settings/settings-panel/ProfileSection.tsx', c);
    console.log("Injected ProfileSection");
}

let r = fs.readFileSync('packages/renderer/src/modules/touring/RoadManager.tsx', 'utf8');
if(!r.includes('const { t } = useTranslation();')) {
    r = r.replace('export const RoadManager: React.FC = () => {', 'export const RoadManager: React.FC = () => {\n    const { t } = useTranslation();');
    fs.writeFileSync('packages/renderer/src/modules/touring/RoadManager.tsx', r);
    console.log("Injected RoadManager");
}
