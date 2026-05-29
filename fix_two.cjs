const fs = require('fs');

let rw = fs.readFileSync('packages/renderer/src/modules/publishing/components/ReleaseWizard.tsx', 'utf8');
rw = rw.replace('export default function ReleaseWizard({ onClose, onComplete }: ReleaseWizardProps) {', 'export default function ReleaseWizard({ onClose, onComplete }: ReleaseWizardProps) {\n  const { t } = useTranslation();');
fs.writeFileSync('packages/renderer/src/modules/publishing/components/ReleaseWizard.tsx', rw);

let pp = fs.readFileSync('packages/renderer/src/modules/social/components/ProductPickerModal.tsx', 'utf8');
pp = pp.replace('export const ProductPickerModal = ({ isOpen, onClose, onSelect }: ProductPickerModalProps) => {', 'export const ProductPickerModal = ({ isOpen, onClose, onSelect }: ProductPickerModalProps) => {\n  const { t } = useTranslation();');
fs.writeFileSync('packages/renderer/src/modules/social/components/ProductPickerModal.tsx', pp);
