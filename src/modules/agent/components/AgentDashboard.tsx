/* eslint-disable @typescript-eslint/no-explicit-any -- Module component with dynamic data */
import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Sparkles, Megaphone, Mail, ExternalLink, RefreshCw, Filter, Download } from 'lucide-react';
import { MarketingService } from '@/services/marketing/MarketingService';
import { CampaignAsset } from '@/modules/marketing/types';
import { VenueScoutService, ScoutEvent } from '../services/VenueScoutService';
import { useAgentStore } from '../store/AgentStore';
import BrowserAgentTester from './BrowserAgentTester';
import { VenueCard } from './VenueCard';
import { ScoutMapVisualization } from './ScoutMapVisualization';
import { MobileOnlyWarning } from '@/core/components/MobileOnlyWarning';
import { useMobile } from '@/hooks/useMobile';
import { AgentSidebar } from './AgentSidebar';
import { AgentToolbar } from './AgentToolbar';
import { ScoutControls } from './ScoutControls';
import { SpecialistSelector } from './SpecialistSelector';
import { TaskTracker } from './TaskTracker';
import { useToast } from '@/core/context/ToastContext';
import { RosterService } from '../services/RosterService';
import { Venue } from '../types';
import { logger } from '@/utils/logger';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { agentService } from '@/services/agent/AgentService';
import { MessageItem } from '@/core/components/chat/ChatMessage';
import { PromptArea } from '@/core/components/command-bar/PromptArea';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

const InboxTabNew = React.lazy(() => import('./InboxTab'));

const STATUS_COLORS: Record<string, string> = {
    active: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    expired: 'bg-slate-700/50 text-slate-500 border-slate-700',
};

const CampaignsTab: React.FC = () => {
    const [campaigns, setCampaigns] = React.useState<CampaignAsset[]>([]);
    const [loading, setLoading] = React.useState(true);

    const fetchCampaigns = React.useCallback(async () => {
        setLoading(true);
        try {
            const data = await MarketingService.getCampaigns();
            setCampaigns(data);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

    return (
        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Megaphone size={18} className="text-cyan-400" /> Campaigns
                </h2>
                <button
                    onClick={fetchCampaigns}
                    className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
                    aria-label="Refresh campaigns"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-slate-900 rounded-xl animate-pulse border border-slate-800" />
                    ))}
                </div>
            ) : campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-600 space-y-3">
                    <Megaphone size={32} className="opacity-30" />
                    <p className="text-sm">No campaigns yet. Create one in the Marketing module.</p>
                    <a
                        href="?module=marketing"
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                    >
                        Go to Marketing <ExternalLink size={10} />
                    </a>
                </div>
            ) : (
                <div className="space-y-3">
                    {campaigns.map((c) => (
                        <div key={c.id ?? c.title} className="bg-slate-900 rounded-xl border border-slate-800 p-4 hover:border-slate-700 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{c.title}</p>
                                    {c.description && (
                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{c.description}</p>
                                    )}
                                    <p className="text-xs text-slate-600 mt-1">
                                        {c.startDate}{c.endDate ? ` → ${c.endDate}` : ''} · {c.durationDays}d · {c.posts.length} posts
                                    </p>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full border capitalize flex-shrink-0 ${STATUS_COLORS[c.status] ?? STATUS_COLORS['expired']}`}>
                                    {c.status}
                                </span>
                            </div>
                            {c.budget !== undefined && (
                                <p className="text-xs text-slate-500 mt-2">Budget: ${c.budget.toLocaleString()}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// No hardcoded inbox data — messages come from connected email integrations.


const AgentDashboard: React.FC = () => {
    // Hooks must be called unconditionally before early returns
    const [activeTab, setActiveTab] = useState<'scout' | 'campaigns' | 'inbox' | 'browser' | 'chat' | 'tasks'>('scout');
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const chatBottomRef = useRef<HTMLDivElement>(null);
    const { agentMessages } = useStore(useShallow(s => ({ agentMessages: s.agentHistory })));

    // Auto-scroll chat to bottom on new messages
    useEffect(() => {
        if (activeTab === 'chat') {
            chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [agentMessages, activeTab]);
    const { venues, isScanning, setScanning, addVenue } = useAgentStore();
    const { showToast } = useToast();
    const [city, setCity] = useState('Nashville');
    const [genre, setGenre] = useState('Rock');
    const [isAutonomous, setIsAutonomous] = useState(false);
    const [scanStatus, setScanStatus] = useState<string>('Ready to deploy');

    // Reactive mobile detection via centralized hook
    const { isAnyPhone } = useMobile();

    // On mobile, default to 'chat' tab and hide desktop-only features
    const defaultTab = isAnyPhone ? 'chat' : 'scout';
    // Set initial tab to appropriate default based on device
    useEffect(() => {
        if (isAnyPhone && (activeTab === 'scout' || activeTab === 'browser')) {
            setActiveTab('chat');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAnyPhone]);

    const handleAddToRoster = async (venue: Venue) => {
        try {
            await RosterService.addToRoster(venue);
            showToast(`Added ${venue.name} to roster`, 'success');
        } catch (error) {
            logger.error('Failed to add to roster:', error);
            showToast('Failed to add venue to roster', 'error');
            throw error; // Let the card handle the loading state reset
        }
    };

    const handleScan = async () => {
        setScanning(true);
        setScanStatus("Initializing agent...");

        try {
            const results = await VenueScoutService.searchVenues(
                city,
                genre,
                isAutonomous,
                (event: ScoutEvent) => {
                    setScanStatus(event.message);
                }
            );

            // Dedup before adding
            let newCount = 0;
            results.forEach(v => {
                const exists = venues.find(existing => existing.id === v.id);
                if (!exists) {
                    addVenue(v);
                    newCount++;
                }
            });

            if (newCount === 0 && results.length > 0) {
                setScanStatus(`Scan complete. Found ${results.length} venues (all already in roster).`);
            } else {
                setScanStatus(`Mission complete. Discovered ${newCount} new venues.`);
            }

        } catch (e) {
            logger.error("Scan failed", e);
            setScanStatus("Mission failed. Connection lost.");
        } finally {
            setScanning(false);
        }
    };

    return (
        <ModuleErrorBoundary moduleName="Agent">
            <div className="flex h-full w-full bg-slate-950 text-white font-sans overflow-hidden">
                {/* Standardized Agent Sidebar — hidden on mobile */}
                {!isAnyPhone && <AgentSidebar activeTab={activeTab} setActiveTab={setActiveTab} />}

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-[--background]">
                    {/* Mobile Tab Strip — visible only on phones */}
                    {isAnyPhone && (
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 overflow-x-auto shrink-0 no-scrollbar">
                            {(['chat', 'tasks', 'campaigns', 'inbox'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                                        activeTab === tab
                                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                    }`}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>
                    )}
                    {/* Top Toolbar — hide on mobile (tab strip replaces it) */}
                    {!isAnyPhone && (
                    <AgentToolbar
                        left={
                            <div className="flex items-center gap-3">
                                <h2 className="font-bold text-lg text-white tracking-tight">Booking Agent</h2>
                                <span className="text-slate-600">/</span>
                                <span className="flex items-center gap-2 text-cyan-400 text-sm font-medium bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                                    <Sparkles size={12} />
                                    {activeTab === 'scout' ? 'The Scout' : activeTab === 'browser' ? 'Browser Agent' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                                </span>
                            </div>
                        }
                        right={
                            <div className="text-xs text-slate-500 font-mono">
                                v2.4.0-alpha
                            </div>
                        }
                    />
                    )}

                    {/* Workspace Content */}
                    <div className="flex-1 flex flex-col overflow-hidden relative">

                        {activeTab === 'scout' && (
                            <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-8">
                                <div className="max-w-7xl mx-auto space-y-10">

                                    {/* Hero Section */}
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <h1 className="text-4xl font-bold text-white tracking-tight">The Scout</h1>
                                            <p className="text-lg text-slate-400 max-w-2xl">
                                                Deploy autonomous agents to identify high-value performance opportunities.
                                                Select your target market and genre focus below.
                                            </p>
                                        </div>

                                        {/* Control Bar - "Platinum Polish" */}
                                        <div className="max-w-4xl">
                                            <ScoutControls
                                                city={city}
                                                setCity={setCity}
                                                genre={genre}
                                                setGenre={setGenre}
                                                isAutonomous={isAutonomous}
                                                setIsAutonomous={setIsAutonomous}
                                                handleScan={handleScan}
                                                isScanning={isScanning}
                                            />
                                        </div>
                                    </div>

                                    {/* Visualization Area - conditionally rendered */}
                                    {isScanning && (
                                        <div className="rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl">
                                            <ScoutMapVisualization status={scanStatus} />
                                        </div>
                                    )}

                                    {/* Results Grid */}
                                    {!isScanning && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                                    Scouted Venues ({venues.length})
                                                </h3>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                {venues.map(venue => (
                                                    <VenueCard
                                                        key={venue.id}
                                                        venue={venue}
                                                        onAdd={handleAddToRoster}
                                                    />
                                                ))}
                                                {venues.length === 0 && (
                                                    <div className="col-span-full py-24 flex flex-col items-center justify-center text-slate-600 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
                                                        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 shadow-inner shadow-black/50">
                                                            <MapPin size={32} className="opacity-40" />
                                                        </div>
                                                        <p className="text-lg font-medium text-slate-400">No venues scouted yet</p>
                                                        <p className="text-sm">Configure your parameters above and deploy the scout.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'browser' && (
                            <div className="h-full bg-[--background]">
                                <BrowserAgentTester />
                            </div>
                        )}

                        {activeTab === 'chat' && (
                            <div className="flex flex-col h-full overflow-hidden">
                                {/* Specialist selector toolbar */}
                                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
                                    <span className="text-xs text-slate-500 font-medium">Route to:</span>
                                    <SpecialistSelector
                                        selectedAgentId={selectedAgentId}
                                        onSelect={setSelectedAgentId}
                                    />
                                    {/* Item 405: Export Chat transcript */}
                                    {agentMessages.length > 0 && (
                                        <button
                                            onClick={() => {
                                                const lines = agentMessages.map(m =>
                                                    `[${new Date(m.timestamp ?? Date.now()).toISOString()}] ${m.role === 'user' ? 'You' : 'Agent'}: ${(m as any).content ?? m.text ?? ''}`
                                                );
                                                const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `agent-chat-${new Date().toISOString().slice(0, 10)}.txt`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="ml-auto p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
                                            title="Export chat transcript"
                                        >
                                            <Download size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Message history */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-2">
                                    {agentMessages.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-3">
                                            <Sparkles size={28} className="opacity-40" />
                                            <p className="text-sm">Start a conversation with your AI team.</p>
                                        </div>
                                    )}
                                    {agentMessages.map((msg) => (
                                        <MessageItem key={msg.id} msg={msg} />
                                    ))}
                                    <div ref={chatBottomRef} />
                                </div>

                                {/* Inline prompt area */}
                                <div className="shrink-0 border-t border-slate-800 px-4 py-3">
                                    <PromptArea />
                                </div>
                            </div>
                        )}

                        {activeTab === 'tasks' && (
                            <div className="h-full overflow-hidden">
                                <TaskTracker />
                            </div>
                        )}

                        {activeTab !== 'scout' && activeTab !== 'browser' && activeTab !== 'chat' && activeTab !== 'tasks' && activeTab !== 'campaigns' && activeTab !== 'inbox' && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                                <div className="p-4 bg-slate-900 rounded-full border border-slate-800">
                                    <Filter size={32} className="opacity-50" />
                                </div>
                            </div>
                        )}


                        {activeTab === 'campaigns' && (
                            <CampaignsTab />
                        )}

                        {activeTab === 'inbox' && (
                            <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="text-sm text-slate-500">Loading inbox...</div></div>}>
                                <InboxTabNew />
                            </React.Suspense>
                        )}

                    </div>
                </div>
            </div>
        </ModuleErrorBoundary>
    );
};

export default AgentDashboard;
