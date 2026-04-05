/**
 * TokenGatedPreview — Item 130 (PRODUCTION_200)
 * Generate hidden landing pages where only proven token/NFT holders
 * can stream unreleased tracks. Includes fan-side preview mockup.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Lock, Unlock, Music, Copy, CheckCircle2, Globe, Plus,
    Trash2, Eye, Play, Pause, Wallet, ExternalLink,
} from 'lucide-react';

interface GatedTrack {
    id: string;
    title: string;
    duration: string;
    bpm: number;
    key: string;
    contractAddress: string;
    tokenId: string;
    previewSlug: string;
    fanViews: number;
    published: boolean;
}

// No hardcoded tracks — data populated via user interaction or Firestore.

// Stable waveform heights — pre-computed once so render stays pure
const WAVEFORM_HEIGHTS = Array.from({ length: 48 }, (_, i) =>
    20 + Math.sin(i * 0.7) * 14 + (((i * 7919) % 97) / 97) * 8
);

function FanPreviewMockup({ track, walletConnected }: { track: GatedTrack; walletConnected: boolean }) {
    const [playing, setPlaying] = useState(false);

    return (
        <div className="rounded-xl border border-white/10 overflow-hidden bg-[#050505]">
            {/* Browser chrome */}
            <div className="bg-white/5 border-b border-white/5 px-4 py-2 flex items-center gap-3">
                <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500/50" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                    <div className="w-2 h-2 rounded-full bg-green-500/50" />
                </div>
                <div className="flex-1 bg-black/30 rounded px-3 py-1 flex items-center gap-2">
                    <Globe size={9} className="text-neutral-600" />
                    <span className="text-[10px] text-neutral-500 font-mono">{track.previewSlug}</span>
                </div>
            </div>

            {/* Fan-facing content */}
            <div className="p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#FFE135]/10 border border-[#FFE135]/20 flex items-center justify-center mx-auto mb-3">
                    <Music size={24} className="text-[#FFE135]" />
                </div>
                <h3 className="text-sm font-black text-white mb-0.5">{track.title}</h3>
                <p className="text-[10px] text-neutral-500 mb-4">
                    {track.bpm} BPM · {track.key} · {track.duration}
                </p>

                {walletConnected ? (
                    <div className="space-y-3">
                        {/* Access granted */}
                        <div className="flex items-center justify-center gap-2 text-green-400 text-xs font-bold">
                            <Unlock size={12} />
                            Access Granted — Token #{track.tokenId} verified
                        </div>
                        {/* Mock waveform */}
                        <div className="relative bg-white/5 rounded-xl overflow-hidden h-14 flex items-center px-4 gap-3">
                            <button
                                onClick={() => setPlaying(p => !p)}
                                className="w-8 h-8 rounded-full bg-[#FFE135] flex items-center justify-center flex-shrink-0 hover:bg-[#FFD700] transition-colors"
                            >
                                {playing
                                    ? <Pause size={12} className="text-black" />
                                    : <Play size={12} className="text-black ml-0.5" />
                                }
                            </button>
                            <div className="flex-1 flex items-end gap-px h-8">
                                {WAVEFORM_HEIGHTS.map((h, i) => (
                                    <div
                                        key={i}
                                        className={`flex-1 rounded-sm transition-colors ${playing && i < 18 ? 'bg-[#FFE135]' : 'bg-white/20'}`}
                                        style={{ height: `${h}%` }}
                                    />
                                ))}
                            </div>
                            <span className="text-[10px] text-neutral-500 flex-shrink-0 font-mono">{track.duration}</span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Locked state */}
                        <div className="relative bg-white/5 rounded-xl overflow-hidden h-14 flex items-center justify-center">
                            <div className="absolute inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center gap-2">
                                <Lock size={14} className="text-neutral-400" />
                                <span className="text-xs text-neutral-400">Token required to listen</span>
                            </div>
                        </div>
                        <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#FFE135] text-black text-xs font-black rounded-xl hover:bg-[#FFD700] transition-colors">
                            <Wallet size={13} />
                            Connect Wallet to Unlock
                        </button>
                        <p className="text-[10px] text-neutral-600">
                            Must hold token #{track.tokenId} from contract {track.contractAddress}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export function TokenGatedPreview() {
    const [tracks, setTracks] = useState<GatedTrack[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [fanPreviewWallet, setFanPreviewWallet] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const selected = tracks.find(t => t.id === selectedId) ?? tracks[0];

    const handleCopy = async (track: GatedTrack) => {
        await navigator.clipboard.writeText(`https://${track.previewSlug}`);
        setCopiedId(track.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const togglePublish = (id: string) => {
        setTracks(prev => prev.map(t => t.id === id ? { ...t, published: !t.published } : t));
    };

    const handleAdd = () => {
        const newTrack: GatedTrack = {
            id: String(Date.now()),
            title: 'New Unreleased Track',
            duration: '0:00',
            bpm: 120,
            key: 'C',
            contractAddress: '0x1a2b...9f3c',
            tokenId: String(tracks.length + 1).padStart(3, '0'),
            previewSlug: `indii.vip/gate/new-track-${Date.now()}`,
            fanViews: 0,
            published: false,
        };
        setTracks(prev => [...prev, newTrack]);
        setSelectedId(newTrack.id);
    };

    const handleDelete = (id: string) => {
        setTracks(prev => prev.filter(t => t.id !== id));
        if (selectedId === id) setSelectedId(tracks.filter(t => t.id !== id)[0]?.id ?? '');
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-bold text-white">Token-Gated Previews</h4>
                    <p className="text-[10px] text-neutral-500 mt-0.5">
                        Only verified token holders can stream hidden tracks
                    </p>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFE135]/10 border border-[#FFE135]/20 rounded-lg text-[11px] font-bold text-[#FFE135] hover:bg-[#FFE135]/20 transition-all"
                >
                    <Plus size={12} /> Add Track
                </button>
            </div>

            <div className="grid grid-cols-2 gap-5">
                {/* Left — track list */}
                <div className="space-y-2">
                    {tracks.map(track => (
                        <div
                            key={track.id}
                            onClick={() => setSelectedId(track.id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all group ${selectedId === track.id
                                ? 'border-[#FFE135]/30 bg-[#FFE135]/5'
                                : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${track.published ? 'bg-green-500/20' : 'bg-white/5'}`}>
                                        {track.published
                                            ? <Unlock size={11} className="text-green-400" />
                                            : <Lock size={11} className="text-neutral-500" />
                                        }
                                    </div>
                                    <span className="text-xs font-bold text-white truncate">{track.title}</span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleCopy(track); }}
                                        className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
                                    >
                                        {copiedId === track.id
                                            ? <CheckCircle2 size={12} className="text-green-400" />
                                            : <Copy size={12} />
                                        }
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(track.id); }}
                                        className="p-1 rounded hover:bg-red-500/10 text-neutral-500 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                                    <span>{track.bpm} BPM</span>
                                    <span>·</span>
                                    <span>{track.key}</span>
                                    <span>·</span>
                                    <span>{track.duration}</span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-neutral-600">
                                    <Eye size={9} />
                                    {track.fanViews}
                                </div>
                            </div>
                            {/* Slug */}
                            <div className="mt-2 flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                                <Globe size={9} className="text-neutral-600 flex-shrink-0" />
                                <span className="text-[9px] text-neutral-500 font-mono truncate flex-1">{track.previewSlug}</span>
                                <ExternalLink size={9} className="text-neutral-600 flex-shrink-0" />
                            </div>
                            {/* Publish toggle */}
                            <button
                                onClick={(e) => { e.stopPropagation(); togglePublish(track.id); }}
                                className={`mt-2 w-full py-1 rounded-lg text-[10px] font-bold transition-all ${track.published
                                    ? 'bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400'
                                    : 'bg-white/5 border border-white/10 text-neutral-500 hover:text-white'
                                    }`}
                            >
                                {track.published ? 'Published — Click to Unpublish' : 'Publish Gate'}
                            </button>
                        </div>
                    ))}

                    {tracks.length === 0 && (
                        <div className="py-8 text-center text-neutral-600 text-xs">
                            No gated tracks yet. Add one above.
                        </div>
                    )}
                </div>

                {/* Right — fan preview */}
                {selected && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Fan Preview</span>
                            <button
                                onClick={() => setFanPreviewWallet(p => !p)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${fanPreviewWallet
                                    ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                                    : 'bg-white/5 border border-white/10 text-neutral-500 hover:text-white'
                                    }`}
                            >
                                <Wallet size={10} />
                                {fanPreviewWallet ? 'Wallet Connected' : 'Simulate Wallet'}
                            </button>
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selected.id + String(fanPreviewWallet)}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                            >
                                <FanPreviewMockup track={selected} walletConnected={fanPreviewWallet} />
                            </motion.div>
                        </AnimatePresence>

                        {/* Token config summary */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-1.5 text-[10px]">
                            <div className="text-neutral-500 font-bold uppercase tracking-widest mb-2">Gate Config</div>
                            <div className="flex justify-between">
                                <span className="text-neutral-600">Contract</span>
                                <span className="font-mono text-neutral-400">{selected.contractAddress}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-600">Token ID</span>
                                <span className="font-mono text-neutral-400">#{selected.tokenId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-600">Status</span>
                                <span className={selected.published ? 'text-green-400' : 'text-yellow-400'}>
                                    {selected.published ? 'Live' : 'Draft'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-600">Fan Views</span>
                                <span className="text-neutral-400">{selected.fanViews.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
