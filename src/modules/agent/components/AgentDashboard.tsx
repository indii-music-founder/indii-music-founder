import * as React from 'react';
import { useState } from 'react';
import { MapPin, Sparkles } from 'lucide-react';
import { VenueScoutService, ScoutEvent } from '../services/VenueScoutService';
import { useAgentStore } from '../store/AgentStore';
import BrowserAgentTester from './BrowserAgentTester';
import { VenueCard } from './VenueCard';
import { ScoutMapVisualization } from './ScoutMapVisualization';
import { MobileOnlyWarning } from '@/core/components/MobileOnlyWarning';
import { AgentSidebar } from './AgentSidebar';
import { AgentToolbar } from './AgentToolbar';
import { ScoutControls } from './ScoutControls';

const AgentDashboard: React.FC = () => {
    // Hooks must be called unconditionally before early returns
    const [activeTab, setActiveTab] = useState<'scout' | 'campaigns' | 'inbox' | 'browser'>('scout');
    const { venues, isScanning, setScanning, addVenue } = useAgentStore();
    const [city, setCity] = useState('Nashville');
    const [genre, setGenre] = useState('Rock');
    const [isAutonomous, setIsAutonomous] = useState(false);
    const [scanStatus, setScanStatus] = useState<string>('Ready to deploy');

    // Check if device is mobile AFTER hooks are called
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    if (isMobile) {
        return (
            <MobileOnlyWarning
                featureName="Agent Dashboard"
                reason="The venue scout and map visualization features require a larger screen for optimal map interaction and venue analysis."
                suggestedModule="touring"
            />
        );
    }

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
            console.error("Scan failed", e);
            setScanStatus("Mission failed. Connection lost.");
        } finally {
            setScanning(false);
        }
    };

    return (
        <div className="flex h-full w-full bg-slate-950 text-white font-sans overflow-hidden">
            {/* Standardized Agent Sidebar */}
            <AgentSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-[--background]">
                {/* Top Toolbar */}
                <AgentToolbar
                    left={
                        <div className="flex items-center gap-3">
                            <h2 className="font-bold text-lg text-white tracking-tight">Agent Tools</h2>
                            <span className="text-slate-600">/</span>
                            <span className="flex items-center gap-2 text-emerald-400 text-sm font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
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
                                                <VenueCard key={venue.id} venue={venue} onAdd={(v) => console.log("Added", v.name)} />
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

                    {activeTab !== 'scout' && activeTab !== 'browser' && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                            <div className="p-4 bg-slate-900 rounded-full border border-slate-800">
                                <Sparkles size={32} className="opacity-50" />
                            </div>
                            <p className="text-lg font-medium">Module under construction</p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

