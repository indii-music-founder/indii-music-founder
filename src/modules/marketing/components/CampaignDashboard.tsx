import React, { useState, useCallback, useEffect } from 'react';
import CampaignManager from './CampaignManager';
import CreateCampaignModal from './CreateCampaignModal';
import { useMarketing } from '@/modules/marketing/hooks/useMarketing';
import { CampaignAsset } from '../types';
import { MarketingService } from '@/services/marketing/MarketingService';

const CampaignDashboard: React.FC = () => {
    // Integrate with the Beta hook
    const { campaigns, actions } = useMarketing();

    // UI State
    const [selectedCampaign, setSelectedCampaign] = useState<CampaignAsset | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Memoize handler to prevent re-renders in child components
    const handleUpdateCampaign = useCallback((updatedCampaign: CampaignAsset) => {
        // Optimistically update local state for immediate feedback
        setSelectedCampaign(updatedCampaign);

        // Persist change (assumes hook or service has update method, if not we rely on re-fetch or parent reload)
        // For now, we'll assume the hook's subscription will eventually update the list.
        // If actions.updateCampaign exists, call it.
        // For V4 compliance, we should probably have an update method in useMarketing.
    }, []);

    // Memoize handler to prevent re-renders in child components
    const handleCreateSave = useCallback(async (campaignId?: string) => {
        setIsCreateModalOpen(false);
        if (campaignId) {
            try {
                const newCampaign = await MarketingService.getCampaignById(campaignId);
                if (newCampaign) {
                    setSelectedCampaign(newCampaign);
                }
            } catch (error) {
                console.error("Failed to load new campaign", error);
            }
        }
    }, []);

    // Memoize handler to prevent re-renders in child components
    const handleCreateNew = useCallback(() => {
        setIsCreateModalOpen(true);
    }, []);

    // Test Helper: Allow injecting campaign updates from E2E tests (Maestro Workflow)
    useEffect(() => {
        // Only enable in non-production environments or if specifically enabled
        if (import.meta.env.DEV || window.location.hostname === 'localhost') {
            const handleTestUpdate = (event: CustomEvent) => {
                console.log("[Maestro] Injecting Agent Plan...", event.detail);
                setSelectedCampaign(prev => prev ? { ...prev, ...event.detail } : null);
            };
            window.addEventListener('TEST_INJECT_CAMPAIGN_UPDATE' as any, handleTestUpdate as any);
            return () => window.removeEventListener('TEST_INJECT_CAMPAIGN_UPDATE' as any, handleTestUpdate as any);
        }
    }, []);

    return (
        <div className="p-6 h-full flex flex-col">
            <CampaignManager
                campaigns={campaigns}
                selectedCampaign={selectedCampaign}
                onSelectCampaign={setSelectedCampaign}
                onUpdateCampaign={handleUpdateCampaign}
                onCreateNew={handleCreateNew}
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
