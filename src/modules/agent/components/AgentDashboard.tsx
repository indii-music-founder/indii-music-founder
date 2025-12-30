import React, { useState } from 'react';
import { Map, MapPin, Users, Mail, List, Globe, Search, Filter, Sparkles } from 'lucide-react';
import { VenueScoutService, ScoutEvent } from '../services/VenueScoutService';
import { useAgentStore } from '../store/AgentStore';
import { Venue } from '../types';
import BrowserAgentTester from './BrowserAgentTester';
import { VenueCard } from './VenueCard';
import { ScoutMapVisualization } from './ScoutMapVisualization';

const AgentDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'scout' | 'campaigns' | 'inbox' | 'browser'>('scout');
    const { venues, isScanning, setScanning, addVenue } = useAgentStore();
    const [city, setCity] = useState('Nashville');
    const [genre, setGenre] = useState('Rock');
    const [isAutonomous, setIsAutonomous] = useState(false);
    const [scanStatus, setScanStatus] = useState<string>('Ready to deploy');

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
        <div className="flex h-full w-full bg-slate-950 text-white font-sans">
            {/* Agent Sidebar */}
            <div className="w-64 border-r border-slate-800 p-4 flex flex-col gap-2 bg-slate-900/50">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-3 px-2">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <MapPin className="text-slate-900" size={20} />
                    </div>
                    Agent.ai
                </h2>

                <NavButton
                    active={activeTab === 'scout'}
                    onClick={() => setActiveTab('scout')}
                    icon={<Map size={18} />}
                    label="The Scout"
                />
                <NavButton
                    active={activeTab === 'browser'}
                    onClick={() => setActiveTab('browser')}
                    icon={<Globe size={18} />}
                    label="Browser Agent"
                />
                <NavButton
                    active={activeTab === 'campaigns'}
                    onClick={() => setActiveTab('campaigns')}
                    icon={<List size={18} />}
                    label="Campaigns"
                />
                <NavButton
                    active={activeTab === 'inbox'}
                    onClick={() => setActiveTab('inbox')}
                    icon={<Mail size={18} />}
                    label="Inbox"
                />
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8 overflow-y-auto bg-gradient-to-br from-slate-950 to-slate-900">
                {activeTab === 'scout' && (
                    <div className="space-y-8 max-w-6xl mx-auto">

                        {/* Header & Controls */}
                        <div className="flex flex-col gap-6">
                            <div>
                                <h1 className="text-3xl font-bold text-white mb-2">The Scout</h1>
                                <p className="text-slate-400">Deploy autonomous agents to find performance opportunities.</p>
                            </div>

                            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl shadow-xl flex flex-wrap gap-4 items-end">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Target City</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 text-slate-600" size={16} />
                                        <input
                                            value={city}
                                            onChange={(e) => setCity(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-700"
                                            placeholder="e.g. Nashville, TN"
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 min-w-[200px]">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Genre Focus</label>
                                    <input
                                        value={genre}
                                        onChange={(e) => setGenre(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-700"
                                        placeholder="e.g. Indie Rock"
                                    />
                                </div>

                                <div className="flex items-center gap-3 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 h-[38px] cursor-pointer hover:border-slate-600 transition-colors">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isAutonomous ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                                            {isAutonomous && <CheckIcon />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={isAutonomous}
                                            onChange={(e) => setIsAutonomous(e.target.checked)}
                                            className="hidden"
                                        />
                                        <span className={`text-sm font-medium ${isAutonomous ? 'text-emerald-400' : 'text-slate-400'}`}>
                                            Autonomous Mode
                                        </span>
                                    </label>
                                </div>

                                <button
                                    onClick={handleScan}
                                    disabled={isScanning}
                                    className={`
                                        h-[38px] px-6 rounded-lg font-bold text-sm tracking-wide transition-all flex items-center gap-2 shadow-lg
                                        ${isScanning
                                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-105 active:scale-95 shadow-emerald-900/30'}
                                    `}
                                >
                                    {isScanning ? (
                                        <>
                                            <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                                            Deploying...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={16} /> Deploy Scout
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Visualization Area */}
                        {isScanning && (
                            <ScoutMapVisualization status={scanStatus} />
                        )}

                        {/* Results Grid */}
                        {!isScanning && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {venues.map(venue => (
                                    <VenueCard key={venue.id} venue={venue} onAdd={(v) => console.log("Added", v.name)} />
                                ))}
                                {venues.length === 0 && (
                                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                                        <MapPin size={48} className="mb-4 opacity-50" />
                                        <p className="text-lg font-medium">No venues scouted yet</p>
                                        <p className="text-sm">Configure your parameters above and deploy the scout.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'browser' && (
                    <BrowserAgentTester />
                )}

                {activeTab !== 'scout' && activeTab !== 'browser' && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                        <div className="p-4 bg-slate-900 rounded-full">
                            <Filter size={32} />
                        </div>
                        <p>Module under construction</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const NavButton = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-all duration-200 font-medium ${active
                ? 'bg-emerald-500/10 text-emerald-400 shadow-sm border border-emerald-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-3 h-3 text-slate-950">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

export default AgentDashboard;
