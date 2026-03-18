import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import {
    MessageCircle, Image, Film, Music,
    Maximize2, Clock, Sparkles, X,
} from 'lucide-react';

/* ── type badge config ───────────────────────────────────────────── */
const BADGE: Record<string, { icon: React.ElementType; label: string; cls: string }> = {
    image: { icon: Image, label: 'Image', cls: 'text-blue-400 bg-blue-500/15' },
    video: { icon: Film, label: 'Video', cls: 'text-purple-400 bg-purple-500/15' },
    music: { icon: Music, label: 'Audio', cls: 'text-amber-400 bg-amber-500/15' },
    text:  { icon: Sparkles, label: 'Text', cls: 'text-emerald-400 bg-emerald-500/15' },
};

function relTime(ts: number) {
    const d = Date.now() - ts;
    const m = Math.floor(d / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * AssetSpotlight — vertical grid of recent creative assets.
 * Fits inside a sidebar panel. Click to expand details.
 */
export default function AssetSpotlight() {
    const {
        generatedHistory,
        toggleAgentWindow,
        isAgentOpen,
        setModule,
        setSelectedItem,
    } = useStore(
        useShallow((s) => ({
            generatedHistory: s.generatedHistory,
            toggleAgentWindow: s.toggleAgentWindow,
            isAgentOpen: s.isAgentOpen,
            setModule: s.setModule,
            setSelectedItem: s.setSelectedItem,
        }))
    );

    const [selIdx, setSelIdx] = useState<number | null>(null);
    const assets = generatedHistory.slice(0, 12);

    const handleDiscuss = (asset: (typeof assets)[0]) => {
        const label = asset.type || 'creation';
        useStore.setState({
            commandBarInput: `Let's discuss this ${label} I created: "${asset.prompt?.slice(0, 80) ?? ''}"`,
        });
        if (!isAgentOpen) toggleAgentWindow();
    };

    const openInStudio = (asset: (typeof assets)[0]) => {
        setSelectedItem(asset);
        setModule('creative');
    };

    /* ── empty state ─────────────────────────────────────────────── */
    if (assets.length === 0) {
        return (
            <div className="bg-[#161b22]/50 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={14} className="text-purple-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Your Creations</h3>
                </div>
                <div className="flex items-center justify-center py-6 text-center">
                    <div>
                        <div className="w-10 h-10 rounded-xl bg-gray-800/50 flex items-center justify-center mx-auto mb-2">
                            <Image size={18} className="text-gray-600" />
                        </div>
                        <p className="text-xs text-gray-400 mb-0.5">No creations yet</p>
                        <p className="text-[10px] text-gray-600">Generate images, videos, or music</p>
                    </div>
                </div>
            </div>
        );
    }

    const sel = selIdx !== null ? assets[selIdx] : null;

    return (
        <div className="bg-[#161b22]/50 border border-white/5 rounded-xl p-3">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2.5 px-0.5">
                <Sparkles size={13} className="text-purple-400" />
                <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">Your Creations</h3>
                <span className="text-[9px] text-gray-600 ml-auto">{assets.length}</span>
            </div>

            {/* Grid — 2 columns */}
            <div className="grid grid-cols-2 gap-2">
                {assets.map((asset, i) => {
                    const badge = BADGE[asset.type] ?? BADGE['image']!;
                    const BadgeIcon = badge.icon;
                    const isSelected = selIdx === i;
                    return (
                        <motion.button
                            key={asset.id}
                            onClick={() => setSelIdx(isSelected ? null : i)}
                            className={`rounded-lg overflow-hidden border transition-all text-left ${
                                isSelected
                                    ? 'border-purple-500/50 ring-1 ring-purple-500/20'
                                    : 'border-white/5 hover:border-white/15'
                            }`}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.02 }}
                        >
                            {/* Thumbnail */}
                            <div className="aspect-square bg-gray-900 relative overflow-hidden">
                                {asset.type === 'image' || asset.type === 'video' ? (
                                    <img
                                        src={asset.thumbnailUrl || asset.url}
                                        alt={asset.prompt}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                                        <BadgeIcon size={24} className="text-gray-600" />
                                    </div>
                                )}
                                {/* Badge */}
                                <div className={`absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-medium backdrop-blur-sm ${badge.cls}`}>
                                    <BadgeIcon size={8} />
                                    {badge.label}
                                </div>
                            </div>
                            {/* Caption */}
                            <div className="p-1.5 bg-[#0d1117]">
                                <p className="text-[10px] text-gray-400 line-clamp-1 leading-tight">
                                    {asset.prompt || 'Untitled'}
                                </p>
                                <div className="flex items-center gap-1 text-[8px] text-gray-600 mt-0.5">
                                    <Clock size={7} />
                                    <span>{relTime(asset.timestamp)}</span>
                                </div>
                            </div>
                        </motion.button>
                    );
                })}
            </div>

            {/* Expanded detail */}
            <AnimatePresence>
                {sel && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-2.5 p-2.5 rounded-lg bg-black/30 border border-white/5">
                            {/* Preview */}
                            <div className="w-full aspect-video rounded-md overflow-hidden bg-gray-900 mb-2">
                                {(sel.type === 'image' || sel.type === 'video') ? (
                                    <img src={sel.url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        {React.createElement(BADGE[sel.type]?.icon || Image, { size: 28, className: 'text-gray-600' })}
                                    </div>
                                )}
                            </div>
                            <p className="text-[11px] text-gray-300 line-clamp-2 mb-1.5 leading-snug">{sel.prompt}</p>
                            <div className="flex flex-wrap gap-1.5 text-[9px] text-gray-500 mb-2">
                                <span>{relTime(sel.timestamp)}</span>
                                {sel.category && <span>· {sel.category}</span>}
                            </div>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => handleDiscuss(sel)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/15 text-purple-400 text-[10px] font-medium hover:bg-purple-500/25 transition-colors"
                                >
                                    <MessageCircle size={10} />
                                    Discuss
                                </button>
                                <button
                                    onClick={() => openInStudio(sel)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 text-gray-400 text-[10px] font-medium hover:bg-white/10 transition-colors"
                                >
                                    <Maximize2 size={10} />
                                    Studio
                                </button>
                                <button
                                    onClick={() => setSelIdx(null)}
                                    className="ml-auto p-1 rounded text-gray-600 hover:text-gray-300 transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
