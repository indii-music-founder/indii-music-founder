import React, { useState, useCallback, useEffect } from 'react';
import CampaignManager from './CampaignManager';
import CreateCampaignModal from './CreateCampaignModal';
import { MarketingSidebar } from './MarketingSidebar';
import { MarketingToolbar } from './MarketingToolbar';
import AIGenerateCampaignModal from './AIGenerateCampaignModal';
import { useMarketing } from '@/modules/marketing/hooks/useMarketing';
import { CampaignAsset } from '../types';
import { MarketingService } from '@/services/marketing/MarketingService';

const CampaignDashboard: React.FC = () => {
    // Integrate with the Beta hook
    const { campaigns, actions } = useMarketing();

    // UI State
    const [selectedCampaign, setSelectedCampaign] = useState<CampaignAsset | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
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

    const handleAISave = useCallback(async (campaign: CampaignAsset) => {
        setIsAIModalOpen(false);
        try {
            // Remove temp ID if key exists, but createCampaign expects specific shape
            // We assume MarketingService.createCampaign handles this map or we conform to it
            const newId = await MarketingService.createCampaign({
                ...campaign,
                status: campaign.status || 'pending',
            });
            const savedCampaign = await MarketingService.getCampaignById(newId);
            if (savedCampaign) setSelectedCampaign(savedCampaign);
        } catch (error) {
            console.error("Failed to save AI campaign", error);
        }
    }, []);

    // Memoize handler to prevent re-renders in child components
    const handleCreateNew = useCallback(() => {
        setIsCreateModalOpen(true);
    }, []);

    // Memoize handler to prevent re-renders in child components
    const handleAIGenerate = useCallback(() => {
        setIsAIModalOpen(true);
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
                            onAIGenerate={handleAIGenerate}
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

            {isAIModalOpen && (
                <AIGenerateCampaignModal
                    onClose={() => setIsAIModalOpen(false)}
                    onSave={handleAISave}
                />
            )}
        </div>
    );
};

export default CampaignDashboard;
