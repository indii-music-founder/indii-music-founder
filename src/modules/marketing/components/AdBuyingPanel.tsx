import React, { useState } from 'react';
import {
    Megaphone, DollarSign, Users, MapPin, Play, Pause,
    Loader2, CheckCircle, TrendingUp, Target, Plus, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Campaign {
    id: string;
    platform: 'Meta' | 'TikTok Ads';
    budget: number;
    genre: string;
    ageRange: string;
    location: string;
    status: 'running' | 'paused';
    reach: number;
    spend: number;
}

const BUDGET_PRESETS = [5, 10, 25, 50];

const MOCK_CAMPAIGNS: Campaign[] = [
    {
        id: 'camp-001',
        platform: 'Meta',
        budget: 10,
        genre: 'Hip-Hop',
        ageRange: '18-24',
        location: 'United States',
        status: 'running',
        reach: 12400,
        spend: 47.20,
    },
    {
        id: 'camp-002',
        platform: 'TikTok Ads',
        budget: 25,
        genre: 'R&B',
        ageRange: '18-34',
        location: 'Global',
        status: 'paused',
        reach: 31800,
        spend: 112.50,
    },
];

const GENRES = ['Hip-Hop', 'R&B', 'Pop', 'Electronic', 'Alternative', 'Afrobeats', 'Latin', 'Rock'];
const AGE_RANGES = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'];
const LOCATIONS = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Global', 'Europe'];

export default function AdBuyingPanel() {
    const [platform, setPlatform] = useState<'Meta' | 'TikTok Ads'>('Meta');
    const [budget, setBudget] = useState(10);
    const [genre, setGenre] = useState('Hip-Hop');
    const [ageRange, setAgeRange] = useState('18-24');
    const [location, setLocation] = useState('United States');
    const [deploying, setDeploying] = useState(false);
    const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);
    const [deployResult, setDeployResult] = useState<{ id: string; reach: number } | null>(null);

    const handleDeploy = () => {
        setDeploying(true);
        setDeployResult(null);
        setTimeout(() => {
            const newId = `camp-${String(campaigns.length + 1).padStart(3, '0')}`;
            const estimatedReach = Math.floor(budget * 1200 + 2000);
            const newCampaign: Campaign = {
                id: newId,
                platform,
                budget,
                genre,
                ageRange,
                location,
                status: 'running',
                reach: estimatedReach,
                spend: 0,
            };
            setCampaigns(prev => [newCampaign, ...prev]);
            setDeployResult({ id: newId, reach: estimatedReach });
            setDeploying(false);
        }, 2000);
    };

    const toggleCampaign = (id: string) => {
        setCampaigns(prev =>
            prev.map(c =>
                c.id === id
                    ? { ...c, status: c.status === 'running' ? 'paused' : 'running' }
                    : c
            )
        );
    };

    return (
        <div className="flex flex-col gap-6 p-6 max-w-2xl">
            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Megaphone size={18} className="text-dept-marketing" />
                    Ad Buying Automation
                </h2>
                <p className="text-xs text-gray-500 mt-1">Deploy micro-budget campaigns on Meta & TikTok.</p>
            </div>

            {/* Platform Toggle */}
            <div className="flex gap-2">
                {(['Meta', 'TikTok Ads'] as const).map(p => (
                    <button
                        key={p}
                        onClick={() => setPlatform(p)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            platform === p
                                ? 'bg-dept-marketing text-white shadow-lg shadow-dept-marketing/20'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        {p}
                    </button>
                ))}
            </div>

            {/* Budget Presets */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <DollarSign size={12} />
                    Daily Budget
                </label>
                <div className="flex gap-2 flex-wrap">
                    {BUDGET_PRESETS.map(b => (
                        <button
                            key={b}
                            onClick={() => setBudget(b)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                budget === b
                                    ? 'bg-dept-marketing/20 border border-dept-marketing text-dept-marketing'
                                    : 'bg-white/5 border border-white/10 text-gray-300 hover:border-white/20'
                            }`}
                        >
                            ${b}/day
                        </button>
                    ))}
                    <input
                        type="number"
                        value={budget}
                        onChange={e => setBudget(Number(e.target.value))}
                        className="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:border-dept-marketing/50 outline-none"
                        placeholder="Custom"
                        min={1}
                    />
                </div>
            </div>

            {/* Targeting */}
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                        <Tag size={10} /> Genre
                    </label>
                    <select
                        value={genre}
                        onChange={e => setGenre(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-dept-marketing/50 appearance-none cursor-pointer"
                    >
                        {GENRES.map(g => <option key={g} value={g} className="bg-[#111]">{g}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                        <Users size={10} /> Age Range
                    </label>
                    <select
                        value={ageRange}
                        onChange={e => setAgeRange(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-dept-marketing/50 appearance-none cursor-pointer"
                    >
                        {AGE_RANGES.map(a => <option key={a} value={a} className="bg-[#111]">{a}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                        <MapPin size={10} /> Location
                    </label>
                    <select
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-dept-marketing/50 appearance-none cursor-pointer"
                    >
                        {LOCATIONS.map(l => <option key={l} value={l} className="bg-[#111]">{l}</option>)}
                    </select>
                </div>
            </div>

            {/* Deploy Button */}
            <button
                onClick={handleDeploy}
                disabled={deploying}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-dept-marketing text-white font-semibold text-sm hover:bg-dept-marketing/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-dept-marketing/20"
            >
                {deploying ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Deploying Campaign...
                    </>
                ) : (
                    <>
                        <Plus size={16} />
                        Deploy Campaign
                    </>
                )}
            </button>

            {/* Deploy Result */}
            <AnimatePresence>
                {deployResult && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start gap-3"
                    >
                        <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-green-400">Campaign Deployed</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                ID: <span className="text-white font-mono">{deployResult.id}</span> &nbsp;·&nbsp;
                                Est. Reach: <span className="text-white">{deployResult.reach.toLocaleString()} users/day</span>
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Running Campaigns */}
            <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Target size={11} /> Running Campaigns
                </h3>
                <div className="space-y-2">
                    {campaigns.map(c => (
                        <div
                            key={c.id}
                            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all"
                        >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.status === 'running' ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-white">{c.platform}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400">{c.genre}</span>
                                    <span className="text-[10px] text-gray-500 font-mono">{c.id}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                        <DollarSign size={9} />${c.budget}/day
                                    </span>
                                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                        <TrendingUp size={9} />{c.reach.toLocaleString()} est. reach
                                    </span>
                                    <span className="text-[10px] text-gray-500">Spent: ${c.spend.toFixed(2)}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => toggleCampaign(c.id)}
                                className={`p-1.5 rounded-lg transition-all ${
                                    c.status === 'running'
                                        ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                }`}
                                title={c.status === 'running' ? 'Pause' : 'Resume'}
                            >
                                {c.status === 'running' ? <Pause size={13} /> : <Play size={13} />}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
