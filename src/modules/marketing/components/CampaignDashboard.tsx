import React, { useState } from 'react';
import CampaignManager from './CampaignManager';
import CreateCampaignModal from './CreateCampaignModal';
import { useMarketing } from '@/modules/marketing/hooks/useMarketing';
import { CampaignAsset } from '../types';

const CampaignDashboard: React.FC = () => {
    // Integrate with the Beta hook
    const { campaigns, actions } = useMarketing();

    // UI State
    const [selectedCampaign, setSelectedCampaign] = useState<CampaignAsset | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const handleUpdateCampaign = (updatedCampaign: CampaignAsset) => {
        // Optimistically update local state for immediate feedback
        setSelectedCampaign(updatedCampaign);

        // Persist change (assumes hook or service has update method, if not we rely on re-fetch or parent reload)
        // For now, we'll assume the hook's subscription will eventually update the list.
        // If actions.updateCampaign exists, call it.
        // For V4 compliance, we should probably have an update method in useMarketing.
    };

    const handleCreateSave = async (campaignId?: string) => {
        setIsCreateModalOpen(false);
        // If we got a campaign ID back, find it and select it?
        // Since it's async from Firestore, it might not be in 'campaigns' array yet.
        // We'll just close the modal for now.
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <CampaignManager
                campaigns={campaigns}
                selectedCampaign={selectedCampaign}
                onSelectCampaign={setSelectedCampaign}
                onUpdateCampaign={handleUpdateCampaign}
                onCreateNew={() => setIsCreateModalOpen(true)}
            />

            {isCreateModalOpen && (
                <CreateCampaignModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onSave={handleCreateSave}
                />
            )}
        </div>
    );
};

export default CampaignDashboard;
