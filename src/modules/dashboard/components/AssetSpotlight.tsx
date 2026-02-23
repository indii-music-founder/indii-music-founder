import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import {
    ChevronLeft, ChevronRight, MessageCircle, Eye,
    Image, Film, Music, Maximize2, Clock, Sparkles, X,
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
 * AssetSpotlight — horizontal carousel of the user's recent creative assets.
 * Click an asset to expand details & "Discuss with indii".
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

    const scrollRef = useRef<HTMLDivElement>(null);
    const [canL, setCanL] = useState(false);
    const [canR, setCanR] = useState(false);
    const [selIdx, setSelIdx] = useState<number | null>(null);

    const assets = generatedHistory.slice(0, 24);

    /* ── scroll state ────────────────────────────────────────────── */
    const syncScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanL(el.scrollLeft > 10);
        setCanR(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        syncScroll();
        el.addEventListener('scroll', syncScroll, { passive: true });
        const ro = new ResizeObserver(syncScroll);
        ro.observe(el);
        return () => { el.removeEventListener('scroll', syncScroll); ro.disconnect(); };
    }, [assets.length, syncScroll]);

    const scroll = (dir: 'left' | 'right') => {
        scrollRef.current?.scrollBy({ left: dir === 'left' ? -260 : 260, behavior: 'smooth' });
    };

    /* ── discuss action ──────────────────────────────────────────── */
    const handleDiscuss = (asset: (typeof assets)[0]) => {
        const label = asset.type || 'creation';
        // Pre-fill commandBar input so user sees the prompt
        useStore.setState({
            commandBarInput: `Let's discuss this ${label} I created: "${asset.prompt?.slice(0, 80) ?? ''}"`,
        });
        if (!isAgentOpen) toggleAgentWindow();
    };

    /* ── open in studio ──────────────────────────────────────────── */
    const openInStudio = (asset: (typeof assets)[0]) => {
        setSelectedItem(asset);
        setModule('creative');
    };

    /* ── empty state ─────────────────────────────────────────────── */
    if (assets.length === 0) {
        return (
            <div className="bg-[#161b22]/50 border border-white/5 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={14} className="text-purple-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Your Creations</h3>
                </div>
                <div className="flex items-center justify-center py-8 text-center">
                    <div>
                        <div className="w-12 h-12 rounded-xl bg-gray-800/50 flex items-center justify-center mx-auto mb-3">
                            <Image size={20} className="text-gray-600" />
                        </div>
                        <p className="text-sm text-gray-400 mb-1">No creations yet</p>
                        <p className="text-[10px] text-gray-600">Generate images, videos, or music to see them here</p>
                    </div>
                </div>
            </div>
        );
    }

    const sel = selIdx !== null ? assets[selIdx] : null;

    return (
        <div className="bg-[#161b22]/50 border border-white/5 rounded-xl p-4 relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Your Creations</h3>
                    <span className="text-[10px] text-gray-600 ml-1">{assets.length} recent</span>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={() => scroll('left')}
                        disabled={!canL}
                        className="p-1.5 rounded-md bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-default transition-all"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <button
                        onClick={() => scroll('right')}
                        disabled={!canR}
                        className="p-1.5 rounded-md bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-default transition-all"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* Carousel */}
            <div
                ref={scrollRef}
                className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {assets.map((asset, i) => {
                    const badge = BADGE[asset.type] || BADGE.image;
                    const BadgeIcon = badge.icon;
                    const isSelected = selIdx === i;
                    return (
                        <motion.button
                            key={asset.id}
                            onClick={() => setSelIdx(isSelected ? null : i)}
                            className={`flex-shrink-0 w-[172px] snap-start rounded-lg overflow-hidden border transition-all text-left ${
                                isSelected
                                    ? 'border-purple-500/50 ring-1 ring-purple-500/20'
                                    : 'border-white/5 hover:border-white/15'
                            }`}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.025 }}
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
                                        <BadgeIcon size={32} className="text-gray-600" />
                                    </div>
                                )}
                                {/* Badge */}
                                <div className={`absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium backdrop-blur-sm ${badge.cls}`}>
                                    <BadgeIcon size={9} />
                                    {badge.label}
                                </div>
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                    <Eye size={18} className="text-white" />
                                </div>
                            </div>
                            {/* Info */}
                            <div className="p-2.5 bg-[#0d1117]">
                                <p className="text-[11px] text-gray-300 line-clamp-2 leading-tight mb-1.5">
                                    {asset.prompt || 'Untitled'}
                                </p>
                                <div className="flex items-center gap-1.5 text-[9px] text-gray-600">
                                    <Clock size={9} />
                                    <span>{relTime(asset.timestamp)}</span>
                                </div>
                            </div>
                        </motion.button>
                    );
                })}
            </div>

            {/* Expanded detail panel */}
            <AnimatePresence>
                {sel && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-3 p-3 rounded-lg bg-black/30 border border-white/5 flex gap-4 items-start">
                            {/* Preview */}
                            <div className="w-28 h-28 rounded-lg overflow-hidden flex-shrink-0 bg-gray-900">
                                {(sel.type === 'image' || sel.type === 'video') ? (
                                    <img src={sel.url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        {React.createElement(BADGE[sel.type]?.icon || Image, { size: 28, className: 'text-gray-600' })}
                                    </div>
                                )}
                            </div>
                            {/* Details */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-200 mb-2 line-clamp-3 leading-snug">{sel.prompt}</p>
                                <div className="flex flex-wrap gap-2 text-[10px] text-gray-500 mb-3">
                                    <span>{relTime(sel.timestamp)}</span>
                                    {sel.category && <span className="text-gray-600">· {sel.category}</span>}
                                    {sel.origin && <span className="text-gray-600">· {sel.origin}</span>}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDiscuss(sel)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-400 text-[11px] font-medium hover:bg-purple-500/25 transition-colors"
                                    >
                                        <MessageCircle size={12} />
                                        Discuss with indii
                                    </button>
                                    <button
                                        onClick={() => openInStudio(sel)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-[11px] font-medium hover:bg-white/10 hover:text-white transition-colors"
                                    >
                                        <Maximize2 size={12} />
                                        Open in Studio
                                    </button>
                                </div>
                            </div>
                            {/* Close */}
                            <button
                                onClick={() => setSelIdx(null)}
                                className="p-1 rounded text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
