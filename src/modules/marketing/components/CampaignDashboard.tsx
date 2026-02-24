import React, { useState, useCallback, useEffect } from 'react';
import CampaignManager from './CampaignManager';
import CreateCampaignModal from './CreateCampaignModal';
import { MarketingSidebar } from './MarketingSidebar';
import { MarketingToolbar } from './MarketingToolbar';
import AIGenerateCampaignModal from './AIGenerateCampaignModal';
import { useMarketing } from '@/modules/marketing/hooks/useMarketing';
import { CampaignAsset } from '../types';
import { MarketingService } from '@/services/marketing/MarketingService';
import { Loader2, BarChart3, TrendingUp, MousePointerClick, Image, Sparkles, Radio } from 'lucide-react';
import { motion } from 'motion/react';

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
                console.error("Failed to load new campaign", error);
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
            console.error("Failed to save AI campaign", error);
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
                            <div className="h-full flex flex-col items-center justify-center text-gray-500" data-testid="marketing-dashboard-loader">
                                <Loader2 className="animate-spin mb-4" size={48} />
                                <p className="text-lg animate-pulse">Loading campaigns...</p>
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
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                            <p className="text-lg">This module is correctly under development.</p>
                            <p className="text-sm opacity-60">Check back later for {activeTab} features.</p>
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
        { label: 'Avg. Engagement', value: '4.2%', icon: MousePointerClick, color: 'text-purple-400' },
        { label: 'Growth', value: '+18%', icon: TrendingUp, color: 'text-emerald-400' },
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
    const assets = [
        { name: 'Brand Logo Pack', type: 'Images', count: 12 },
        { name: 'Press Kit Photos', type: 'Images', count: 8 },
        { name: 'Social Templates', type: 'Templates', count: 5 },
        { name: 'Copy Library', type: 'Text', count: 24 },
    ];

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Asset Library</h3>
            <div className="space-y-1">
                {assets.map((a) => (
                    <div key={a.name} className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer">
                        <Image size={12} className="text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-300 truncate">{a.name}</p>
                            <p className="text-[10px] text-gray-600">{a.type} · {a.count} items</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AISuggestionsPanel() {
    const suggestions = [
        'Post Reels on Fri 6PM for max engagement',
        'Your audience prefers behind-the-scenes content',
        'Try carousel posts — 2.3x higher save rate',
    ];

    return (
        <div className="rounded-xl bg-dept-marketing/5 border border-dept-marketing/10 p-3">
            <h3 className="text-[10px] font-bold text-dept-marketing uppercase tracking-widest mb-3 px-1 flex items-center gap-1.5">
                <Sparkles size={10} /> AI Suggestions
            </h3>
            <div className="space-y-2">
                {suggestions.map((s, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-white/[0.02] text-xs text-gray-300 leading-relaxed">
                        {s}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default CampaignDashboard;
