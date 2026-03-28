import React, { useState, useCallback, useEffect } from 'react';
import CampaignManager from './CampaignManager';
import CreateCampaignModal from './CreateCampaignModal';
import { MarketingSidebar } from './MarketingSidebar';
import { MarketingToolbar } from './MarketingToolbar';
import AIGenerateCampaignModal from './AIGenerateCampaignModal';
import MarketingAssetGeneratorUI from './MarketingAssetGeneratorUI';
import AdBuyingPanel from './AdBuyingPanel';
import EmailMarketingPanel from './EmailMarketingPanel';
import PreSaveCampaignBuilder from './PreSaveCampaignBuilder';
import SMSMarketingPanel from './SMSMarketingPanel';
import FanDataEnrichment from './FanDataEnrichment';
import EPKGenerator from './EPKGenerator';
import CommunityWebhookPanel from './CommunityWebhookPanel';
import InfluencerBountyBoard from './InfluencerBountyBoard';
import MomentumTracker from './MomentumTracker';
import MultiPlatformPoster from './MultiPlatformPoster';
import { useMarketing } from '@/modules/marketing/hooks/useMarketing';
import { CampaignAsset } from '../types';
import { MarketingService } from '@/services/marketing/MarketingService';
import { BarChart3, TrendingUp, MousePointerClick, Image, Sparkles, Radio } from 'lucide-react';
import { motion } from 'motion/react';
import { logger } from '@/utils/logger';
import { SkeletonList, SkeletonStat } from '@/components/shared/SkeletonLoader';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';

/* ================================================================== */
/*  Campaign Dashboard — Three-Panel Layout                             */
/*                                                                     */
/*  ┌──────────┬───────────────────────────┬──────────────┐            */
/*  │  LEFT    │    CENTER                 │   RIGHT      │            */
/*  │  Mktg    │    Campaign Manager       │   Perf       │            */
/*  │  Sidebar │    (workspace)            │   Snapshot   │            */
/*  │  (nav)   │                           │   Assets     │            */
/*  │          │                           │   AI Tips    │            */
/*  └──────────┴───────────────────────────┴──────────────┘            */
/* ================================================================== */

const CampaignDashboard: React.FC = () => {
    const { campaigns, actions, isLoading } = useMarketing();

    const [selectedCampaign, setSelectedCampaign] = useState<CampaignAsset | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('campaigns');

    const handleUpdateCampaign = useCallback((updatedCampaign: CampaignAsset) => {
        setSelectedCampaign(updatedCampaign);
    }, []);

    const handleCreateSave = useCallback(async (campaignId?: string) => {
        setIsCreateModalOpen(false);
        if (campaignId) {
            try {
                const newCampaign = await MarketingService.getCampaignById(campaignId);
                if (newCampaign) {
                    setSelectedCampaign(newCampaign);
                }
            } catch (error) {
                logger.error("Failed to load new campaign", error);
            }
        }
    }, []);

    const handleAISave = useCallback(async (campaign: CampaignAsset) => {
        setIsAIModalOpen(false);
        try {
            const newId = await MarketingService.createCampaign({
                ...campaign,
                status: campaign.status || 'pending',
            });
            const savedCampaign = await MarketingService.getCampaignById(newId);
            if (savedCampaign) setSelectedCampaign(savedCampaign);
        } catch (error) {
            logger.error("Failed to save AI campaign", error);
        }
    }, []);

    const handleCreateNew = useCallback(() => {
        setIsCreateModalOpen(true);
    }, []);

    const handleAIGenerate = useCallback(() => {
        setIsAIModalOpen(true);
    }, []);

    // E2E Test Injection Hook
    useEffect(() => {
        const handleTestInjection = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail && customEvent.detail.posts) {
                setSelectedCampaign(prev => {
                    if (!prev) return prev;
                    return { ...prev, posts: customEvent.detail.posts };
                });
            }
        };

        window.addEventListener('TEST_INJECT_CAMPAIGN_UPDATE', handleTestInjection);

        const handleTestSetCampaign = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail && customEvent.detail.campaign) {
                setSelectedCampaign(customEvent.detail.campaign);
            }
        };

        if (import.meta.env.DEV) {
            window.addEventListener('TEST_INJECT_SET_CAMPAIGN', handleTestSetCampaign);
        }

        return () => {
            window.removeEventListener('TEST_INJECT_CAMPAIGN_UPDATE', handleTestInjection);
            if (import.meta.env.DEV) {
                window.removeEventListener('TEST_INJECT_SET_CAMPAIGN', handleTestSetCampaign);
            }
        };
    }, []);


    return (
        <ModuleErrorBoundary moduleName="Marketing Dashboard">
            <div className="absolute inset-0 flex bg-background text-foreground font-sans selection:bg-dept-marketing/30">
                {/* ── LEFT PANEL — Marketing Sidebar (existing) ────── */}
                <MarketingSidebar
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />

                {/* ── CENTER — Campaign Workspace ────────────────────── */}
                <div className="flex-1 flex flex-col min-w-0 bg-background">
                    <MarketingToolbar
                        onAction={handleCreateNew}
                        actionLabel="New Campaign"
                    />

                    <div className="flex-1 overflow-hidden relative">
                        <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-dept-marketing/10 to-transparent pointer-events-none" />

                        {activeTab === 'campaigns' || activeTab === 'overview' ? (
                            isLoading ? (
                                <div className="p-4 space-y-4" data-testid="marketing-dashboard-loader" aria-busy="true" aria-label="Loading campaigns">
                                    <div className="grid grid-cols-3 gap-3">
                                        <SkeletonStat /><SkeletonStat /><SkeletonStat />
                                    </div>
                                    <SkeletonList rows={5} />
                                </div>
                            ) : (
                                <CampaignManager
                                    campaigns={campaigns}
                                    selectedCampaign={selectedCampaign}
                                    onSelectCampaign={setSelectedCampaign}
                                    onUpdateCampaign={handleUpdateCampaign}
                                    onCreateNew={handleCreateNew}
                                    onAIGenerate={handleAIGenerate}
                                />
                            )
                        ) : activeTab === 'asset-generator' ? (
                            <MarketingAssetGeneratorUI />
                        ) : activeTab === 'ad-buying' ? (
                            <AdBuyingPanel />
                        ) : activeTab === 'email' ? (
                            <EmailMarketingPanel />
                        ) : activeTab === 'pre-save' ? (
                            <PreSaveCampaignBuilder />
                        ) : activeTab === 'sms' ? (
                            <SMSMarketingPanel />
                        ) : activeTab === 'fan-data' ? (
                            <FanDataEnrichment />
                        ) : activeTab === 'epk' ? (
                            <EPKGenerator />
                        ) : activeTab === 'community' ? (
                            <CommunityWebhookPanel />
                        ) : activeTab === 'influencers' ? (
                            <InfluencerBountyBoard />
                        ) : activeTab === 'auto-poster' ? (
                            <MultiPlatformPoster />
                        ) : activeTab === 'momentum' ? (
                            <MomentumTracker />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
                                <Sparkles size={24} className="text-gray-600" />
                                <p className="text-sm font-medium text-gray-400">This feature is launching soon</p>
                                <p className="text-xs text-gray-600 max-w-xs text-center">We're putting the finishing touches on this experience. In the meantime, explore your active campaigns.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT PANEL — Performance & Assets ─────────────── */}
                <aside className="hidden lg:flex w-72 2xl:w-80 flex-col border-l border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                    <PerformanceSnapshotPanel campaigns={campaigns} />
                    <AssetLibraryPanel />
                    <AISuggestionsPanel />
                </aside>

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
        </ModuleErrorBoundary>
    );
};

/* ================================================================== */
/*  Right Panel Widgets                                                 */
/* ================================================================== */

function PerformanceSnapshotPanel({ campaigns }: { campaigns: CampaignAsset[] }) {
    const active = campaigns.filter(c => c.status === 'EXECUTING' || c.status === 'DONE').length;
    const total = campaigns.length;
    const items = [
        { label: 'Active Campaigns', value: active.toString(), icon: Radio, color: 'text-green-400' },
        { label: 'Total Campaigns', value: total.toString(), icon: BarChart3, color: 'text-blue-400' },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Performance</h3>
            <div className="space-y-2">
                {items.map((s) => (
                    <div key={s.label} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                            <s.icon size={14} className={s.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{s.value}</p>
                            <p className="text-[10px] text-gray-500">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AssetLibraryPanel() {
    const { userProfile } = useStore(useShallow(state => ({
        userProfile: state.userProfile
    })));
    const brandAssets = userProfile?.brandKit?.brandAssets || [];
    const referenceImages = userProfile?.brandKit?.referenceImages || [];

    const totalAssets = brandAssets.length + referenceImages.length;

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1 flex items-center justify-between">
                <span>Asset Library</span>
                <span className="text-gray-600">{totalAssets} stored</span>
            </h3>
            {totalAssets === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                    <Image size={16} className="text-gray-600 mb-2" />
                    <p className="text-[11px] text-gray-600">No brand assets uploaded</p>
                    <p className="text-[10px] text-gray-700 mt-0.5">Upload logos, photos, and templates</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    {brandAssets.slice(0, 4).map((asset, i) => (
                        <div key={asset.id || i} className="aspect-square rounded-lg bg-black/40 border border-white/5 overflow-hidden">
                            <img src={asset.url} alt={asset.description} className="w-full h-full object-cover opacity-70 hover:opacity-100 transition-opacity" />
                        </div>
                    ))}
                    {totalAssets > 4 && (
                        <div className="col-span-2 text-center pt-2">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest cursor-pointer hover:text-white">+ {totalAssets - 4} more assets</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function AISuggestionsPanel() {
    return (
        <div className="rounded-xl bg-dept-marketing/5 border border-dept-marketing/10 p-3">
            <h3 className="text-[10px] font-bold text-dept-marketing uppercase tracking-widest mb-3 px-1 flex items-center gap-1.5">
                <Sparkles size={10} /> AI Suggestions
            </h3>
            <div className="flex flex-col items-center justify-center py-4 text-center">
                <Sparkles size={16} className="text-gray-600 mb-2" />
                <p className="text-[11px] text-gray-600">Collecting analytics...</p>
                <p className="text-[10px] text-gray-700 mt-0.5 max-w-[180px]">Need a live campaign generating real-world impressions to formulate predictive growth advice.</p>
            </div>
        </div>
    );
}

export default CampaignDashboard;
