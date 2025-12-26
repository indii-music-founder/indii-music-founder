import React, { useState } from 'react';
import { Map, MapPin, Users, Mail, List } from 'lucide-react';
import { VenueScoutService } from '../services/VenueScoutService';
import { useAgentStore } from '../store/AgentStore';
import { Venue } from '../types';

const AgentDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'scout' | 'campaigns' | 'inbox'>('scout');
    const { venues, isScanning, setScanning, addVenue } = useAgentStore();
    const [city, setCity] = useState('Nashville');
    const [genre, setGenre] = useState('Rock');

    const handleScan = async () => {
        setScanning(true);
        try {
            const results = await VenueScoutService.searchVenues(city, genre);
            // Dedup before adding
            results.forEach(v => {
                if (!venues.find(existing => existing.id === v.id)) {
                    addVenue(v);
                }
            });
        } catch (e) {
            console.error("Scan failed", e);
        } finally {
            setScanning(false);
        }
    };

    return (
        <div className="flex h-full w-full bg-slate-950 text-white">
            {/* Agent Sidebar */}
            <div className="w-64 border-r border-slate-800 p-4 flex flex-col gap-2">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <MapPin className="text-emerald-400" /> Agent.ai
                </h2>

                <NavButton
                    active={activeTab === 'scout'}
                    onClick={() => setActiveTab('scout')}
                    icon={<Map size={18} />}
                    label="The Scout"
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
            <div className="flex-1 p-6 overflow-y-auto">
                {activeTab === 'scout' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h1 className="text-2xl font-bold">Venue Scout</h1>
                            <div className="flex gap-2">
                                <input
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2"
                                    placeholder="Target City"
                                />
                                <input
                                    value={genre}
                                    onChange={(e) => setGenre(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded px-3 py-2"
                                    placeholder="Genre"
                                />
                                <button
                                    onClick={handleScan}
                                    disabled={isScanning}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded flex items-center gap-2"
                                >
                                    {isScanning ? 'Scanning...' : 'Scan Venues'}
                                </button>
                            </div>
                        </div>

                        {/* Visual Map Placeholder */}
                        <div className="bg-slate-900 rounded-xl h-64 border border-slate-800 flex items-center justify-center text-slate-500">
                            Interactive Map Visualization coming in Phase 2
                        </div>

                        {/* Results Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {venues.map(venue => (
                                <VenueCard key={venue.id} venue={venue} />
                            ))}
                            {venues.length === 0 && !isScanning && (
                                <div className="col-span-full text-center py-10 text-slate-500">
                                    No venues found yet. Start a scan to find opportunities.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab !== 'scout' && (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        Module under construction
                    </div>
                )}
            </div>
        </div>
    );
};

const NavButton = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left transition-colors ${active ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-slate-900 text-slate-400'
            }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

const VenueCard = ({ venue }: { venue: Venue }) => (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl hover:border-emerald-500/50 transition-colors cursor-pointer group">
        <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-lg text-white group-hover:text-emerald-400">{venue.name}</h3>
            <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">{venue.city}, {venue.state}</span>
        </div>
        <div className="text-sm text-slate-400 mb-4">
            {venue.genres.join(', ')} • Cap: {venue.capacity}
        </div>
        <div className="flex gap-2">
            <button className="flex-1 bg-slate-800 hover:bg-slate-700 py-1.5 rounded text-xs font-medium text-white transition-colors">
                View Details
            </button>
            <button className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 py-1.5 rounded text-xs font-medium transition-colors">
                Add to List
            </button>
        </div>
    </div>
);

export default AgentDashboard;
