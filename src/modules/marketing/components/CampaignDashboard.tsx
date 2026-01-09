import React, { useState, useCallback, useEffect } from 'react';
import CampaignManager from './CampaignManager';
import CreateCampaignModal from './CreateCampaignModal';
import { MarketingSidebar } from './MarketingSidebar';
import { MarketingToolbar } from './MarketingToolbar';
import { useMarketing } from '@/modules/marketing/hooks/useMarketing';
import { CampaignAsset } from '../types';
import { MarketingService } from '@/services/marketing/MarketingService';

const CampaignDashboard: React.FC = () => {
    // Integrate with the Beta hook
    const { campaigns, actions } = useMarketing();

    // UI State
    const [selectedCampaign, setSelectedCampaign] = useState<CampaignAsset | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('campaigns');

    // Memoize handler to prevent re-renders in child components
    const handleUpdateCampaign = useCallback((updatedCampaign: CampaignAsset) => {
        // Optimistically update local state for immediate feedback
        setSelectedCampaign(updatedCampaign);
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
        <div className="flex h-full bg-slate-950 overflow-hidden text-slate-200 font-sans selection:bg-purple-500/30">
            {/* Sidebar */}
            <MarketingSidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-slate-950 to-slate-900/50">
                <MarketingToolbar
                    onAction={handleCreateNew}
                    actionLabel="New Campaign"
                />

                <div className="flex-1 overflow-hidden relative">
                    {/* Background Ambient Glow */}
                    <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />

                    {activeTab === 'campaigns' || activeTab === 'overview' ? (
                        <CampaignManager
                            campaigns={campaigns}
                            selectedCampaign={selectedCampaign}
                            onSelectCampaign={setSelectedCampaign}
                            onUpdateCampaign={handleUpdateCampaign}
                            onCreateNew={handleCreateNew}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                            <p className="text-lg">This module is correctly under development.</p>
                            <p className="text-sm opacity-60">Check back later for {activeTab} features.</p>
                        </div>
                    )}
                </div>
            </div>

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
