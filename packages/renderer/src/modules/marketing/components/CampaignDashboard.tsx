import React, { useState, useCallback, useEffect, useMemo } from 'react';
import CampaignManager from './CampaignManager';
import CreateCampaignModal from './CreateCampaignModal';
import { MarketingSidebar } from './MarketingSidebar';
import { MarketingToolbar } from './MarketingToolbar';
import IntelligenceCampaignModal from './IntelligenceCampaignModal';
import MarketingAssetGeneratorUI from './MarketingAssetGeneratorUI';
import AdBuyingPanel from './AdBuyingPanel';
import AgentSwarmDashboard from './AgentSwarmDashboard';
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
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('campaigns');
    const [campaignSearch, setCampaignSearch] = useState('');
    const visibleCampaigns = useMemo(() => {
        const query = campaignSearch.trim().toLowerCase();
        if (!query) return campaigns;
        return campaigns.filter(campaign =>
            campaign.title.toLowerCase().includes(query)
            || campaign.description?.toLowerCase().includes(query)
            || campaign.posts.some(post => post.platform.toLowerCase().includes(query))
        );
    }, [campaignSearch, campaigns]);

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
                    <MarketingToolbar
                        onAction={handleCreateNew}
                        actionLabel="New Campaign"
                        searchValue={campaignSearch}
                        onSearchChange={setCampaignSearch}
                    />

                    <div className="flex-1 overflow-hidden relative">
                        <div className="absolute top-0 inset-x-0 h-64 bg-linear-to-b from-dept-marketing/10 to-transparent pointer-events-none" />

                        {activeTab === 'campaigns' || activeTab === 'overview' ? (
                            isLoading ? (
                                <div className="p-4 space-y-4" data-testid="marketing-dashboard-loader" role="status"><span className="sr-only">Loading campaigns</span>
                                    <div className="grid grid-cols-3 gap-3">
                                        <SkeletonStat /><SkeletonStat /><SkeletonStat />
                                    </div>
                                    <SkeletonList rows={5} />
                                </div>
                            ) : (
                                <CampaignManager
                                    campaigns={visibleCampaigns}
                                    selectedCampaign={selectedCampaign}
                                    onSelectCampaign={setSelectedCampaign}
                                    onUpdateCampaign={handleUpdateCampaign}
                                    onCreateNew={handleCreateNew}
                                    onAIGenerate={handleAIGenerate}
                                    searchQuery={campaignSearch}
                                    onClearSearch={() => setCampaignSearch('')}
                                />
                            )
                        ) : activeTab === 'asset-generator' ? (
                            <MarketingAssetGeneratorUI />
                        ) : activeTab === 'ad-buying' ? (
                            <AdBuyingPanel />
                        ) : activeTab === 'swarm' ? (
                            <AgentSwarmDashboard />
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
                <aside className="hidden @6xl:flex w-72 @7xl:w-80 flex-col border-l border-white/10 overflow-y-auto p-3 gap-3 flex-shrink-0 bg-[#000000]/20">
                    <PerformanceSnapshotPanel campaigns={campaigns} />
                    <AssetLibraryPanel />
                    <IntelligenceSuggestionsPanel campaigns={campaigns} />
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
        { label: 'Active Campaigns', value: active.toString(), icon: Radio, color: 'text-[#00B8D4]' },
        { label: 'Total Campaigns', value: total.toString(), icon: BarChart3, color: 'text-[#FFB800]' },
    ];

    return (
        <div className="rounded-2xl bg-[#14100C]/70 border border-white/10 backdrop-blur-md p-4 shadow-sm">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-1 flex items-center justify-between">
                <span>Performance</span>
                <span className="text-[10px] text-[#FFB800] font-mono">Live Telemetry</span>
            </h3>
            <div className="space-y-2">
                {items.map((s) => (
                    <div key={s.label} className="flex items-center gap-3 p-2.5 rounded-xl bg-black/40 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                            <s.icon size={14} className={s.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{s.value}</p>
                            <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
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
        <div className="rounded-2xl bg-[#14100C]/70 border border-white/10 backdrop-blur-md p-4 shadow-sm">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-1 flex items-center justify-between">
                <span>Asset Library</span>
                <span className="text-gray-500 font-mono">{totalAssets} stored</span>
            </h3>
            {totalAssets === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                    <Image size={18} className="text-gray-500 mb-2 opacity-60" />
                    <p className="text-xs font-semibold text-gray-400">No brand assets uploaded</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Upload logos, photos, and templates</p>
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
                            <p className="text-[10px] text-[#FFB800] font-bold uppercase tracking-widest">+ {totalAssets - 4} more assets</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function IntelligenceSuggestionsPanel({ campaigns }: { campaigns: CampaignAsset[] }) {
    const executingCampaign = campaigns.find(c => c.status === 'EXECUTING');

    return (
        <div className="rounded-2xl bg-[#14100C]/70 border border-[#FFB800]/20 backdrop-blur-md p-4 shadow-[0_0_20px_rgba(255,184,0,0.06)]">
            <h3 className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest mb-3 px-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                    <Sparkles size={12} className="text-[#FFB800]" /> Autonomous Suggestions
                </span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#FFB800]/10 border border-[#FFB800]/30 text-[#FFD700]">Recommended</span>
            </h3>
            {executingCampaign ? (
                <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-black/50 border border-white/5">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFB800] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFD700]"></span>
                            </span>
                            <p className="text-xs font-bold text-white truncate">{executingCampaign.title}</p>
                        </div>
                        <p className="text-[11px] text-gray-300 leading-relaxed font-mono">
                            {executingCampaign.posts?.length || 0} drops queued · {executingCampaign.durationDays}d timeline
                        </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#FFB800]/5 border border-[#FFB800]/15">
                        <p className="text-[10px] uppercase font-bold text-[#FFB800] tracking-wider mb-1">Recommended Next Step</p>
                        <p className="text-xs text-gray-300 leading-relaxed">
                            Multi-platform queue active. Generate matching 60fps lyric video clips in Video Studio to pair with release drops.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                    <Sparkles size={18} className="text-[#FFB800]/60 mb-2" />
                    <p className="text-xs font-semibold text-gray-300">Ready to Launch</p>
                    <p className="text-[11px] text-gray-400 mt-1 max-w-[200px] leading-relaxed">
                        Create your first release campaign using Intelligence to synchronize multi-platform social drops.
                    </p>
                </div>
            )}
        </div>
    );
}

export default CampaignDashboard;
