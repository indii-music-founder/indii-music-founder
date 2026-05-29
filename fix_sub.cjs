const fs = require('fs');
const replaces = [
    {
        file: 'packages/renderer/src/modules/publishing/components/MechanicalRoyaltyPanel.tsx',
        search: 'function AddCoverTrackForm({ releaseId, onAdded, onCancel }: AddCoverFormProps) {',
        replace: 'function AddCoverTrackForm({ releaseId, onAdded, onCancel }: AddCoverFormProps) {\n    const { t } = useTranslation();'
    }
];

for (const {file, search, replace} of replaces) {
    let c = fs.readFileSync(file, 'utf8');
    c = c.replace(search, replace);
    fs.writeFileSync(file, c);
}
