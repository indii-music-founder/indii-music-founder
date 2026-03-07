/**
 * SuperfanCRM — Item 129 (PRODUCTION_200)
 * Fan tiering dashboard: Standard / VIP / Superfan
 * Tracks fan spend, engagement, and tier progression.
 * Uses Contact type extended with mock fan-tier data.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, Star, Users, TrendingUp, Gift, Send, ChevronUp, Search } from 'lucide-react';
import { Contact } from '../types';

type FanTier = 'Superfan' | 'VIP' | 'Standard';

interface FanRecord {
    id: string;
    name: string;
    email: string;
    tier: FanTier;
    totalSpend: number;
    streamsThisMonth: number;
    lastActive: string;
    avatarInitial: string;
}

const MOCK_FANS: FanRecord[] = [
    { id: '1', name: 'Aisha Thompson', email: 'aisha@mail.com', tier: 'Superfan', totalSpend: 847, streamsThisMonth: 2340, lastActive: '2 hours ago', avatarInitial: 'A' },
    { id: '2', name: 'Marcus Webb', email: 'mwebb@mail.com', tier: 'Superfan', totalSpend: 612, streamsThisMonth: 1980, lastActive: '5 hours ago', avatarInitial: 'M' },
    { id: '3', name: 'Priya Nair', email: 'priya@mail.com', tier: 'VIP', totalSpend: 289, streamsThisMonth: 890, lastActive: '1 day ago', avatarInitial: 'P' },
    { id: '4', name: 'Jordan Lee', email: 'jlee@mail.com', tier: 'VIP', totalSpend: 214, streamsThisMonth: 740, lastActive: '2 days ago', avatarInitial: 'J' },
    { id: '5', name: 'Elena Rossi', email: 'elenr@mail.com', tier: 'VIP', totalSpend: 178, streamsThisMonth: 560, lastActive: '3 days ago', avatarInitial: 'E' },
    { id: '6', name: 'Devon Clark', email: 'dclark@mail.com', tier: 'Standard', totalSpend: 45, streamsThisMonth: 210, lastActive: '1 week ago', avatarInitial: 'D' },
    { id: '7', name: 'Nadia Kim', email: 'nadk@mail.com', tier: 'Standard', totalSpend: 32, streamsThisMonth: 180, lastActive: '1 week ago', avatarInitial: 'N' },
    { id: '8', name: 'Carlos Vega', email: 'cvega@mail.com', tier: 'Standard', totalSpend: 18, streamsThisMonth: 95, lastActive: '2 weeks ago', avatarInitial: 'C' },
];

const TIER_CONFIG: Record<FanTier, { color: string; bg: string; border: string; icon: React.ReactNode; threshold: string }> = {
    Superfan: {
        color: 'text-amber-400',
        bg: 'bg-amber-400/10',
        border: 'border-amber-400/30',
        icon: <Crown size={12} />,
        threshold: '$500+ spend',
    },
    VIP: {
        color: 'text-purple-400',
        bg: 'bg-purple-400/10',
        border: 'border-purple-400/30',
        icon: <Star size={12} />,
        threshold: '$100–$499',
    },
    Standard: {
        color: 'text-slate-400',
        bg: 'bg-slate-400/10',
        border: 'border-slate-400/20',
        icon: <Users size={12} />,
        threshold: 'Under $100',
    },
};

interface SuperfanCRMProps {
    contacts?: Contact[];
}

export function SuperfanCRM({ contacts: _contacts }: SuperfanCRMProps) {
    const [activeTier, setActiveTier] = useState<FanTier | 'all'>('all');
    const [search, setSearch] = useState('');
    const [fans] = useState<FanRecord[]>(MOCK_FANS);

    const filtered = fans.filter(f => {
        const matchTier = activeTier === 'all' || f.tier === activeTier;
        const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase());
        return matchTier && matchSearch;
    });

    const tierCounts = {
        Superfan: fans.filter(f => f.tier === 'Superfan').length,
        VIP: fans.filter(f => f.tier === 'VIP').length,
        Standard: fans.filter(f => f.tier === 'Standard').length,
    };

    const totalRevenue = fans.reduce((sum, f) => sum + f.totalSpend, 0);

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-8 py-6 border-b border-white/5">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Superfan CRM</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Track and engage your most loyal fans</p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-dept-marketing/20 border border-dept-marketing/30 text-dept-marketing-glow rounded-lg text-xs font-bold hover:bg-dept-marketing/30 transition-all">
                        <Send size={12} />
                        Broadcast Message
                    </button>
                </div>

                {/* Tier Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                    <div
                        onClick={() => setActiveTier('all')}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${activeTier === 'all' ? 'bg-white/10 border-white/20' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
                    >
                        <div className="text-2xl font-black text-white mb-1">{fans.length}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Total Fans</div>
                        <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                            <TrendingUp size={10} />
                            ${totalRevenue.toLocaleString()} LTV
                        </div>
                    </div>
                    {(['Superfan', 'VIP', 'Standard'] as FanTier[]).map(tier => {
                        const cfg = TIER_CONFIG[tier];
                        return (
                            <div
                                key={tier}
                                onClick={() => setActiveTier(activeTier === tier ? 'all' : tier)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${activeTier === tier ? `${cfg.bg} ${cfg.border}` : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
                            >
                                <div className={`text-2xl font-black ${cfg.color} mb-1`}>{tierCounts[tier]}</div>
                                <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${cfg.color}`}>
                                    {cfg.icon} {tier}s
                                </div>
                                <div className="text-[10px] text-slate-600 mt-1">{cfg.threshold}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Search */}
            <div className="px-8 py-4 border-b border-white/5">
                <div className="relative max-w-sm">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search fans..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-white/20 transition-colors"
                    />
                </div>
            </div>

            {/* Fan Table */}
            <div className="flex-1 overflow-y-auto px-8 py-4 no-scrollbar">
                <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                        {filtered.map((fan, i) => {
                            const cfg = TIER_CONFIG[fan.tier];
                            return (
                                <motion.div
                                    key={fan.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    transition={{ delay: i * 0.04 }}
                                    className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/10 hover:bg-white/[0.04] transition-all group"
                                >
                                    {/* Avatar */}
                                    <div className={`w-9 h-9 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center font-bold text-sm ${cfg.color} flex-shrink-0`}>
                                        {fan.avatarInitial}
                                    </div>

                                    {/* Name + Email */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-white truncate">{fan.name}</div>
                                        <div className="text-[11px] text-slate-600 truncate">{fan.email}</div>
                                    </div>

                                    {/* Tier Badge */}
                                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.border} border ${cfg.color}`}>
                                        {cfg.icon}
                                        {fan.tier}
                                    </div>

                                    {/* Stats */}
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-white">${fan.totalSpend.toLocaleString()}</div>
                                        <div className="text-[10px] text-slate-600">lifetime spend</div>
                                    </div>
                                    <div className="text-right w-20 hidden xl:block">
                                        <div className="text-sm font-bold text-emerald-400">{fan.streamsThisMonth.toLocaleString()}</div>
                                        <div className="text-[10px] text-slate-600">streams/mo</div>
                                    </div>
                                    <div className="text-[10px] text-slate-600 w-24 text-right hidden 2xl:block">{fan.lastActive}</div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {fan.tier !== 'Superfan' && (
                                            <button className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${cfg.bg} ${cfg.color} hover:opacity-80 transition-opacity`}>
                                                <ChevronUp size={10} />
                                                Upgrade
                                            </button>
                                        )}
                                        <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-white/5 text-slate-400 hover:text-white transition-colors">
                                            <Gift size={10} />
                                            Exclusive
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {filtered.length === 0 && (
                        <div className="py-20 text-center">
                            <Users size={28} className="mx-auto text-slate-700 mb-3" />
                            <p className="text-sm text-slate-500">No fans match your filters.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
