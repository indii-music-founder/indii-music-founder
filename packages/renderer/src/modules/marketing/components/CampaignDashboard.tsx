import React, { useState, useCallback, useEffect } from 'react';
import CampaignManager from './CampaignManager';
import CreateCampaignModal from './CreateCampaignModal';
import GeoBountyDeployerModal from './GeoBountyDeployerModal';
import { MarketingSidebar } from './MarketingSidebar';
import { MarketingToolbar } from './MarketingToolbar';
import IntelligenceCampaignModal from './IntelligenceCampaignModal';
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
import { CampaignAsset, CampaignStatus } from '../types';
import { MarketingService } from '@/services/marketing/MarketingService';
import { BarChart3, Image, Sparkles, Radio } from 'lucide-react';
import { logger } from '@/utils/logger';
import { SkeletonList, SkeletonStat } from '@/components/shared/SkeletonLoader';
import { useStore } from '@/core/store';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';
import { useShallow } from 'zustand/react/shallow';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { useToast } from '@/core/context/ToastContext';

/* ================================================================== */
/*  Campaign Dashboard — Three-Panel Layout                             */
/*                                                                     */
/*  ┌──────────┬───────────────────────────┬──────────────┐            */
/*  │  LEFT    │    CENTER                 │   RIGHT      │            */
/*  │  Mktg    │    Campaign Manager       │   Perf       │            */
/*  │  Sidebar │    (workspace)            │   Snapshot   │            */
/*  │  (nav)   │                           │   Assets     │            */
/*  │          │                           │   Autonomous Tips    │            */
/*  └──────────┴───────────────────────────┴──────────────┘            */
/* ================================================================== */

const CampaignDashboard: React.FC = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { campaigns, actions, isLoading } = useMarketing();
    const toast = useToast();

    const [selectedCampaign, setSelectedCampaign] = useState<CampaignAsset | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isGeoBountyModalOpen, setIsGeoBountyModalOpen] = useState(false);
    const [deployedBounty, setDeployedBounty] = useState<string | null>(null);
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('campaigns');

    /**
     * ISSUE-949: previously only called setSelectedCampaign — image batch
     * Apply & Save, copy edits, and execution status updates all vanished
     * on navigate-away/refresh because nothing ever reached Firestore.
     * Now persists via MarketingService.updateCampaign (already implemented,
     * but had zero callers anywhere in the app) and reverts the optimistic
     * local update if the write fails, so the UI never claims a save that
     * didn't happen.
     */
    const handleUpdateCampaign = useCallback(async (updatedCampaign: CampaignAsset) => {
        const previousCampaign = selectedCampaign;
        setSelectedCampaign(updatedCampaign);

        if (!updatedCampaign.id) return;

        try {
            await MarketingService.updateCampaign(updatedCampaign.id, updatedCampaign);
        } catch (error: unknown) {
            logger.error("Failed to persist campaign update", error);
            setSelectedCampaign(previousCampaign);
            toast.error("Failed to save campaign changes. Please try again.");
            throw error;
        }
    }, [selectedCampaign, toast]);

    const handleCreateSave = useCallback(async (campaignId?: string) => {
        setIsCreateModalOpen(false);
        if (campaignId) {
            try {
                const newCampaign = await MarketingService.getCampaignById(campaignId);
                if (newCampaign) {
                    setSelectedCampaign(newCampaign);
                }
            } catch (error: unknown) {
                logger.error("Failed to load new campaign", error);
            }
        }
    }, []);

    /**
     * ISSUE-951: previously closed the modal (setIsAIModalOpen(false))
     * BEFORE attempting creation, so the modal always appeared to succeed
     * regardless of an auth/permission/quota/validation failure — and the
     * generated plan was gone forever since the modal had already unmounted.
     * Now only closes after a confirmed created+read-back campaign; on
     * failure, re-throws so the modal keeps the plan visible and retryable.
     */
    const handleAISave = useCallback(async (campaign: CampaignAsset) => {
        try {
            const newId = await MarketingService.createCampaign({
                ...campaign,
                status: campaign.status || CampaignStatus.PENDING,
            });
            const savedCampaign = await MarketingService.getCampaignById(newId);
            if (savedCampaign) setSelectedCampaign(savedCampaign);
            setIsAIModalOpen(false);
        } catch (error: unknown) {
            logger.error("Failed to save Autonomous campaign", error);
            toast.error("Failed to create campaign. Please try again.");
            throw error;
        }
    }, [toast]);

    const handleCreateNew = useCallback(() => {
        setIsCreateModalOpen(true);
    }, []);

    const handleDeployBounty = useCallback((location: string, _desc: string) => {
        setIsGeoBountyModalOpen(false);
        setDeployedBounty(location);
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

        if (import.meta.env.DEV || isFirebaseE2EMockEnabled()) {
            window.addEventListener('TEST_INJECT_SET_CAMPAIGN', handleTestSetCampaign);
        }

        return () => {
            window.removeEventListener('TEST_INJECT_CAMPAIGN_UPDATE', handleTestInjection);
            if (import.meta.env.DEV || isFirebaseE2EMockEnabled()) {
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
                <div className="flex-1 flex flex-col min-w-0 bg-background relative">
                    {deployedBounty && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-blue-500/90 text-white px-4 py-2 rounded-full font-semibold shadow-lg text-sm">
                            Mission Active: {deployedBounty}
                        </div>
                    )}
                    <div className="px-4 md:px-6 pt-4">
                        <div className="rounded-[28px] border border-dept-marketing/20 bg-linear-to-r from-dept-marketing/10 via-white/[0.03] to-transparent p-5 md:p-6 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
                            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                                <div className="max-w-2xl">
                                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-dept-marketing">Marketing Narrative</p>
                                    <h3 className="mt-2 text-xl md:text-2xl font-bold tracking-tight text-white">Pocket-team capture for live moments.</h3>
                                    <p className="mt-2 text-sm md:text-[15px] leading-relaxed text-gray-300">
                                        The remote becomes a pocket team-capture lane for voice memos, photos, and quick notes that turn real-world moments into campaign-ready material.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-dept-marketing/80">
                                    <span className="h-2 w-2 rounded-full bg-dept-marketing shadow-[0_0_12px_rgba(233,30,99,0.55)]" />
                                    Marketing page concept
                                </div>
                            </div>
                        </div>
                    </div>
                    <MarketingToolbar
                        onAction={handleCreateNew}
                        actionLabel="New Campaign"
                        onGeoBounty={() => setIsGeoBountyModalOpen(true)}
                    />

                    <div className="flex-1 overflow-hidden relative">
                        <div className="absolute top-0 inset-x-0 h-64 bg-linear-to-b from-dept-marketing/10 to-transparent pointer-events-none" />

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
                                <p className="text-sm font-medium text-gray-400">This section is unavailable</p>
                                <p className="text-xs text-gray-600 max-w-xs text-center">The sidebar still exposes a few future modules that are not wired into this build yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT PANEL — Performance & Assets ─────────────── */}
                <aside className="hidden @6xl:flex w-72 @7xl:w-80 flex-col border-l border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0">
                    <PerformanceSnapshotPanel campaigns={campaigns} />
                    <AssetLibraryPanel />
                    <IntelligenceSuggestionsPanel />
                </aside>

                {isCreateModalOpen && (
                    <CreateCampaignModal
                        onClose={() => setIsCreateModalOpen(false)}
                        onSave={handleCreateSave}
                    />
                )}

                {isAIModalOpen && (
                    <IntelligenceCampaignModal
                        onClose={() => setIsAIModalOpen(false)}
                        onSave={handleAISave}
                    />
                )}

                {isGeoBountyModalOpen && (
                    <GeoBountyDeployerModal
                        onClose={() => setIsGeoBountyModalOpen(false)}
                        onDeploy={handleDeployBounty}
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
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">+ {totalAssets - 4} more assets</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function IntelligenceSuggestionsPanel() {
    return (
        <div className="rounded-xl bg-dept-marketing/5 border border-dept-marketing/10 p-3">
            <h3 className="text-[10px] font-bold text-dept-marketing uppercase tracking-widest mb-3 px-1 flex items-center gap-1.5">
                <Sparkles size={10} /> Autonomous Suggestions
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
