import React, { useState } from 'react';
import CampaignManager from './CampaignManager';
import CreateCampaignModal from './CreateCampaignModal';
import { MarketingService } from '@/services/marketing/MarketingService';
import { CampaignAsset } from '../types';
import { Megaphone } from 'lucide-react';

const CampaignDashboard: React.FC = () => {
    // Placeholder state - in a real app, this would come from a store or API
    const [selectedCampaign, setSelectedCampaign] = useState<CampaignAsset | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const handleUpdate = (updatedCampaign: CampaignAsset) => {
        setSelectedCampaign(updatedCampaign);
    };

    const handleCreateCampaign = () => {
        setIsCreateModalOpen(true);
    };

    const handleCreateSave = async (campaignId?: string) => {
        if (campaignId) {
            const campaign = await MarketingService.getCampaignById(campaignId);
            if (campaign) {
                setSelectedCampaign(campaign);
            }
        }
    };

    const handleOpenCreateModal = () => {
        setIsCreateModalOpen(true);
    };

    if (!selectedCampaign) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-full text-center">
                <div className="p-4 bg-purple-500/10 rounded-full text-purple-400 mb-4">
                    <Megaphone size={48} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Campaign Manager</h2>
                <p className="text-gray-400 max-w-md mb-6">
                    Select a campaign to manage or create a new one to get started with your marketing efforts.
                </p>
                <button
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-colors"
                    onClick={handleCreateCampaign}

                >
                    Create New Campaign
                </button>

                {isCreateModalOpen && (
                    <CreateCampaignModal
                        onClose={() => setIsCreateModalOpen(false)}
                        onSave={handleCreateSave}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Campaign Manager</h1>
                <button
                    onClick={() => setSelectedCampaign(null)}
                    className="text-sm text-gray-400 hover:text-white"
                >
                    Back to Dashboard
                </button>
            </div>
            <CampaignManager campaign={selectedCampaign} onUpdate={handleUpdate} />
        </div>
    );
};

export default CampaignDashboard;
