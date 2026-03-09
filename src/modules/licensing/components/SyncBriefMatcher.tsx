/**
 * SyncBriefMatcher — Item 133 (PRODUCTION_200)
 * Parse ingested daily licensing briefs and automatically suggest which
 * catalog tracks fit the mood/BPM. Mood-score algorithm: cosine similarity
 * on mood tag overlap + BPM window matching.
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Music2, Film, Star, ChevronDown, ChevronUp, RefreshCw, Tag } from 'lucide-react';

type Mood = 'Cinematic' | 'Upbeat' | 'Melancholic' | 'Dark' | 'Chill' | 'Energetic' | 'Romantic' | 'Triumphant';

interface SyncBrief {
    id: string;
    project: string;
    type: 'TV' | 'Film' | 'Ad' | 'Game' | 'Trailer';
    network: string;
    deadline: string;
    bpmMin: number;
    bpmMax: number;
    moods: Mood[];
    budget: string;
    description: string;
}

interface CatalogTrack {
    id: string;
    title: string;
    bpm: number;
    moods: Mood[];
    duration: string;
    isrc: string;
}

// Sync briefs should be loaded from the licensing API/inbox
// The matching algorithm will work once real briefs and catalog tracks are available
const BRIEFS: SyncBrief[] = [];

// Catalog tracks should be loaded from the user's catalog in Firestore
const CATALOG: CatalogTrack[] = [];

function matchScore(brief: SyncBrief, track: CatalogTrack): number {
    // BPM fit: 1.0 if in range, decays outside
    const inRange = track.bpm >= brief.bpmMin && track.bpm <= brief.bpmMax;
    const bpmCenter = (brief.bpmMin + brief.bpmMax) / 2;
    const bpmWindow = (brief.bpmMax - brief.bpmMin) / 2 + 20;
    const bpmScore = inRange ? 1.0 : Math.max(0, 1 - Math.abs(track.bpm - bpmCenter) / bpmWindow);

    // Mood overlap: Jaccard-like
    const overlap = track.moods.filter(m => brief.moods.includes(m)).length;
    const union = new Set([...track.moods, ...brief.moods]).size;
    const moodScore = overlap / union;

    return Math.round((bpmScore * 0.4 + moodScore * 0.6) * 100);
}

const TYPE_COLORS: Record<string, string> = {
    TV: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    Film: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    Ad: 'text-[#FFE135] bg-[#FFE135]/10 border-[#FFE135]/20',
    Game: 'text-green-400 bg-green-400/10 border-green-400/20',
    Trailer: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
};

function ScoreBadge({ score }: { score: number }) {
    const color = score >= 75 ? 'text-green-400 bg-green-400/10 border-green-400/20'
        : score >= 50 ? 'text-[#FFE135] bg-[#FFE135]/10 border-[#FFE135]/20'
            : 'text-neutral-500 bg-white/5 border-white/10';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black ${color}`}>
            <Star size={8} /> {score}%
        </span>
    );
}

function BriefCard({ brief }: { brief: SyncBrief }) {
    const [open, setOpen] = useState(false);
    const matches = useMemo(() => CATALOG
        .map(t => ({ track: t, score: matchScore(brief, t) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4), [brief]);

    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors">
            {/* Brief header */}
            <button onClick={() => setOpen(o => !o)} className="w-full text-left p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest ${TYPE_COLORS[brief.type]}`}>
                                {brief.type}
                            </span>
                            <span className="text-xs font-bold text-white truncate">{brief.project}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-neutral-500 flex-wrap">
                            <span>{brief.network}</span>
                            <span>·</span>
                            <span>{brief.bpmMin}–{brief.bpmMax} BPM</span>
                            <span>·</span>
                            <span className="text-[#FFE135]">{brief.budget}</span>
                            <span>·</span>
                            <span className="text-red-400">Due {brief.deadline}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                            {brief.moods.map(m => (
                                <span key={m} className="text-[9px] px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-neutral-400">
                                    {m}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <ScoreBadge score={matches[0]?.score ?? 0} />
                        {open ? <ChevronUp size={14} className="text-neutral-600" /> : <ChevronDown size={14} className="text-neutral-600" />}
                    </div>
                </div>
            </button>

            {/* Matched tracks */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-3">
                            <p className="text-[10px] text-neutral-500 italic">{brief.description}</p>
                            <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Catalog Matches</div>
                            <div className="space-y-2">
                                {matches.map(({ track, score }) => (
                                    <div key={track.id} className="flex items-center gap-3 p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                                        <Music2 size={13} className="text-neutral-600 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-white truncate">{track.title}</div>
                                            <div className="text-[9px] text-neutral-600 mt-0.5">
                                                {track.bpm} BPM · {track.duration} · {track.isrc}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1 flex-shrink-0 max-w-[120px] justify-end">
                                            {track.moods.filter(m => brief.moods.includes(m)).map(m => (
                                                <span key={m} className="text-[8px] px-1.5 py-0.5 bg-[#FFE135]/10 border border-[#FFE135]/20 rounded-full text-[#FFE135]">{m}</span>
                                            ))}
                                        </div>
                                        <ScoreBadge score={score} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function SyncBriefMatcher() {
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<SyncBrief['type'] | 'All'>('All');

    const filtered = filter === 'All' ? BRIEFS : BRIEFS.filter(b => b.type === filter);

    const handleRefresh = async () => {
        setRefreshing(true);
        await new Promise(r => setTimeout(r, 1200));
        setRefreshing(false);
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-bold text-white">Sync Brief Matcher</h4>
                    <p className="text-[10px] text-neutral-500 mt-0.5">
                        Daily briefs matched against your catalog by mood + BPM
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                        {(['All', 'TV', 'Film', 'Ad', 'Game', 'Trailer'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setFilter(t)}
                                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${filter === t ? 'bg-indigo-500 text-white' : 'text-neutral-500 hover:text-white'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-neutral-400 hover:text-white transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                        Refresh Briefs
                    </button>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: 'Open Briefs', value: BRIEFS.length, icon: <Film size={13} />, color: 'text-indigo-400' },
                    { label: 'High Match (75%+)', value: BRIEFS.filter(b => CATALOG.some(t => matchScore(b, t) >= 75)).length, icon: <Star size={13} />, color: 'text-[#FFE135]' },
                    { label: 'Catalog Tracks', value: CATALOG.length, icon: <Music2 size={13} />, color: 'text-green-400' },
                    { label: 'Top Budget', value: '$50K+', icon: <Zap size={13} />, color: 'text-purple-400' },
                ].map(s => (
                    <div key={s.label} className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                        <div className={`${s.color} mb-1`}>{s.icon}</div>
                        <div className="text-lg font-black text-white">{s.value}</div>
                        <div className="text-[9px] text-neutral-600 uppercase tracking-widest">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Brief cards */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                    <Tag size={10} />
                    Click a brief to see matched catalog tracks
                </div>
                {filtered.map(brief => <BriefCard key={brief.id} brief={brief} />)}
            </div>
        </div>
    );
}
