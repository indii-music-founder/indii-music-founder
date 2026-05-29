const fs = require('fs');

const replaces = [
    {
        file: 'packages/renderer/src/modules/publishing/components/MechanicalRoyaltyPanel.tsx',
        search: 'export function MechanicalRoyaltyPanel({ releaseId = \'default\' }: Props) {',
        replace: 'export function MechanicalRoyaltyPanel({ releaseId = \'default\' }: Props) {\n    const { t } = useTranslation();'
    },
    {
        file: 'packages/renderer/src/modules/social/components/AccountCreationWizard.tsx',
        search: 'export default function AccountCreationWizard({ onClose }: AccountCreationWizardProps) {',
        replace: 'export default function AccountCreationWizard({ onClose }: AccountCreationWizardProps) {\n    const { t } = useTranslation();'
    },
    {
        file: 'packages/renderer/src/modules/social/components/CreatePostModal.tsx',
        search: 'export const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose }) => {',
        replace: 'export const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose }) => {\n    const { t } = useTranslation();'
    },
    {
        file: 'packages/renderer/src/modules/social/components/ProductPickerModal.tsx',
        search: 'export const ProductPickerModal = ({ isOpen, onClose, onSelect }: ProductPickerModalProps) => {',
        replace: 'export const ProductPickerModal = ({ isOpen, onClose, onSelect }: ProductPickerModalProps) => {\n    const { t } = useTranslation();'
    },
    {
        file: 'packages/renderer/src/modules/social/components/SocialFeed.tsx',
        search: 'export const SocialFeed: React.FC<SocialFeedProps> = ({ className }) => {',
        replace: 'export const SocialFeed: React.FC<SocialFeedProps> = ({ className }) => {\n    const { t } = useTranslation();'
    },
    {
        file: 'packages/renderer/src/modules/touring/components/OnTheRoadTab.tsx',
        search: 'export function OnTheRoadTab({ state, onUpdate }: Props) {',
        replace: 'export function OnTheRoadTab({ state, onUpdate }: Props) {\n    const { t } = useTranslation();'
    },
    {
        file: 'packages/renderer/src/modules/touring/components/PlanningTab.tsx',
        search: 'export function PlanningTab({ state, onUpdate }: Props) {',
        replace: 'export function PlanningTab({ state, onUpdate }: Props) {\n    const { t } = useTranslation();'
    },
    {
        file: 'packages/renderer/src/modules/touring/RoadManager.tsx',
        search: 'export const RoadManager: React.FC = () => {',
        replace: 'export const RoadManager: React.FC = () => {\n    const { t } = useTranslation();'
    }
];

for (const {file, search, replace} of replaces) {
    let content = fs.readFileSync(file, 'utf8');
    
    // First, verify `const { t } = useTranslation();` isn't already there?
    // Some might have it in the wrong place, but if it says "Cannot find name 't'", it's not in scope.
    if (!content.includes(replace)) {
        content = content.replace(search, replace);
        fs.writeFileSync(file, content);
        console.log(`Fixed ${file}`);
    } else {
        console.log(`Already fixed ${file}`);
    }
}
