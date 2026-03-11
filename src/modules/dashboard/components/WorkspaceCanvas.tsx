import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Image,
    FileText,
    BarChart3,
    Video,
    Download,
    X,
    Expand,
    Loader2,
    Sparkles,
    ChevronLeft,
    ChevronRight,
    LayoutGrid,
    Columns,
} from 'lucide-react';

/* ================================================================== */
/*  WorkspaceCanvas — Indii's Rich Media Output Panel                  */
/*                                                                      */
/*  The CENTER column of the Agent Workspace. The chat overlay handles */
/*  conversation; this panel is where Indii renders generated images,  */
/*  documents, reports, charts, video previews, and any rich output    */
/*  produced during a task.                                             */
/* ================================================================== */

export type CanvasItemType = 'image' | 'document' | 'chart' | 'video' | 'loading';

export interface CanvasItem {
    id: string;
    type: CanvasItemType;
    title: string;
    createdAt: number;
    imageUrl?: string;
    imagePrompt?: string;
    content?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    chartData?: unknown;
    loadingLabel?: string;
}

type LayoutMode = 'single' | 'grid';

interface WorkspaceCanvasProps {
    items: CanvasItem[];
    onDismiss?: (id: string) => void;
    onExpand?: (item: CanvasItem) => void;
}

/* ── Type Icon helper ─────────────────────────────────────────────── */
function TypeIcon({ type, size = 14 }: { type: CanvasItemType; size?: number }) {
    const cls = 'opacity-60';
    if (type === 'image') return <Image size={size} className={cls} />;
    if (type === 'document') return <FileText size={size} className={cls} />;
    if (type === 'chart') return <BarChart3 size={size} className={cls} />;
    if (type === 'video') return <Video size={size} className={cls} />;
    return <Loader2 size={size} className={`${cls} animate-spin`} />;
}

/* ── Single Canvas Item Card ──────────────────────────────────────── */
function CanvasCard({
    item,
    onDismiss,
    onExpand,
}: {
    item: CanvasItem;
    onDismiss?: (id: string) => void;
    onExpand?: (item: CanvasItem) => void;
}) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-md overflow-hidden group"
        >
            {/* Card Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
                <div className="flex items-center gap-2">
                    <TypeIcon type={item.type} />
                    <span className="text-[11px] font-medium text-white/70 truncate max-w-[200px]">{item.title}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.imageUrl && (
                        <a
                            href={item.imageUrl}
                            download
                            className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                            title="Download"
                        >
                            <Download size={11} />
                        </a>
                    )}
                    {onExpand && (
                        <button
                            onClick={() => onExpand(item)}
                            className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                            title="Expand"
                        >
                            <Expand size={11} />
                        </button>
                    )}
                    {onDismiss && (
                        <button
                            onClick={() => onDismiss(item.id)}
                            className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remove"
                        >
                            <X size={11} />
                        </button>
                    )}
                </div>
            </div>

            {/* Card Body */}
            <div className="p-3">
                {item.type === 'image' && item.imageUrl && (
                    <div className="relative">
                        <img
                            src={item.imageUrl}
                            alt={item.imagePrompt || item.title}
                            className="w-full rounded-xl object-cover max-h-96"
                        />
                        {item.imagePrompt && (
                            <p className="mt-2 text-[10px] text-white/40 italic leading-relaxed line-clamp-2">
                                {item.imagePrompt}
                            </p>
                        )}
                    </div>
                )}

                {item.type === 'document' && item.content && (
                    <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                        <div
                            className="text-[12px] text-white/70 leading-relaxed whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: item.content.replace(/\n/g, '<br/>') }}
                        />
                    </div>
                )}

                {item.type === 'video' && (
                    <div className="relative rounded-xl overflow-hidden bg-black/30">
                        {item.videoUrl ? (
                            <video src={item.videoUrl} controls className="w-full rounded-xl" poster={item.thumbnailUrl} />
                        ) : item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt={item.title} className="w-full rounded-xl object-cover max-h-56" />
                        ) : (
                            <div className="h-40 flex items-center justify-center">
                                <Video size={32} className="text-white/20" />
                            </div>
                        )}
                    </div>
                )}

                {item.type === 'chart' && (
                    <div className="h-40 flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="text-center">
                            <BarChart3 size={28} className="text-indigo-400/50 mx-auto mb-2" />
                            <p className="text-[10px] text-white/30">Chart visualization</p>
                        </div>
                    </div>
                )}

                {item.type === 'loading' && (
                    <div className="h-40 flex flex-col items-center justify-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-400 animate-spin" />
                            <Sparkles size={14} className="absolute inset-0 m-auto text-indigo-400 opacity-60" />
                        </div>
                        <p className="text-[11px] text-white/40 animate-pulse">
                            {item.loadingLabel || 'Generating…'}
                        </p>
                    </div>
                )}
            </div>

            <p className="px-4 pb-2 text-[9px] text-white/20 font-mono">
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
        </motion.div>
    );
}

/* ── Lightbox ─────────────────────────────────────────────────────── */
function Lightbox({ item, onClose }: { item: CanvasItem; onClose: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="relative max-w-5xl max-h-[90vh] w-full mx-4 rounded-2xl overflow-hidden border border-white/10"
            >
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors"
                >
                    <X size={14} />
                </button>
                {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-contain" />
                )}
                {item.type === 'document' && item.content && (
                    <div className="bg-[#0f0f13] p-8 max-h-[80vh] overflow-y-auto">
                        <h2 className="text-lg font-semibold text-white mb-4">{item.title}</h2>
                        <div
                            className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{ __html: item.content.replace(/\n/g, '<br/>') }}
                        />
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

/* ── Empty Canvas State ───────────────────────────────────────────── */
function EmptyCanvas() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full border border-indigo-500/15 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border border-indigo-500/20 flex items-center justify-center">
                        <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center">
                            <Sparkles size={16} className="text-indigo-400/70" />
                        </div>
                    </div>
                </div>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0"
                >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-2 h-2 rounded-full bg-indigo-400/50" />
                </motion.div>
            </div>

            <h3 className="text-sm font-semibold text-white/60 mb-2 tracking-wide">Canvas ready</h3>
            <p className="text-[11px] text-white/25 leading-relaxed max-w-[220px]">
                Generated images, reports, charts, and rich output from Indii will appear here automatically
            </p>

            <div className="mt-6 flex items-center gap-3 flex-wrap justify-center">
                {(['image', 'document', 'chart', 'video'] as CanvasItemType[]).map((t) => (
                    <div
                        key={t}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]"
                    >
                        <TypeIcon type={t} size={10} />
                        <span className="text-[9px] text-white/30 capitalize">{t}s</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Main Exported Component ──────────────────────────────────────── */
export function WorkspaceCanvas({ items, onDismiss, onExpand }: WorkspaceCanvasProps) {
    const [layout, setLayout] = useState<LayoutMode>('single');
    const [activeIndex, setActiveIndex] = useState(0);
    const [lightboxItem, setLightboxItem] = useState<CanvasItem | null>(null);

    const handlePrev = () => setActiveIndex((i) => Math.max(0, i - 1));
    const handleNext = () => setActiveIndex((i) => Math.min(items.length - 1, i + 1));

    React.useEffect(() => {
        if (items.length > 0) setActiveIndex(items.length - 1);
    }, [items.length]);

    const handleExpand = onExpand ?? ((item: CanvasItem) => setLightboxItem(item));

    return (
        <>
            <div className="flex flex-col h-full">
                {/* Toolbar */}
                {items.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04] flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <Sparkles size={12} className="text-indigo-400/60" />
                            <span className="text-[10px] text-white/40 font-medium uppercase tracking-widest">Canvas</span>
                            <span className="text-[10px] text-white/20 font-mono">
                                {items.length} item{items.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {items.length > 1 && (
                            <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
                                <button
                                    onClick={() => setLayout('single')}
                                    title="Single view"
                                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${layout === 'single' ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/60'}`}
                                >
                                    <Columns size={11} />
                                </button>
                                <button
                                    onClick={() => setLayout('grid')}
                                    title="Grid view"
                                    className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${layout === 'grid' ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/60'}`}
                                >
                                    <LayoutGrid size={11} />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 p-4 flex flex-col">
                    {items.length === 0 ? (
                        <EmptyCanvas />
                    ) : layout === 'grid' ? (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                            <AnimatePresence mode="popLayout">
                                {items.map((item) => (
                                    <CanvasCard key={item.id} item={item} onDismiss={onDismiss} onExpand={handleExpand} />
                                ))}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col">
                            <AnimatePresence mode="wait">
                                {items[activeIndex] && (
                                    <CanvasCard
                                        key={items[activeIndex].id}
                                        item={items[activeIndex]}
                                        onDismiss={onDismiss}
                                        onExpand={handleExpand}
                                    />
                                )}
                            </AnimatePresence>

                            {items.length > 1 && (
                                <div className="flex items-center justify-center gap-3 mt-4">
                                    <button
                                        onClick={handlePrev}
                                        disabled={activeIndex === 0}
                                        className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft size={12} />
                                    </button>

                                    <div className="flex items-center gap-1.5">
                                        {items.map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setActiveIndex(i)}
                                                className={`rounded-full transition-all duration-200 ${i === activeIndex
                                                    ? 'w-4 h-1.5 bg-indigo-400'
                                                    : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'
                                                    }`}
                                            />
                                        ))}
                                    </div>

                                    <button
                                        onClick={handleNext}
                                        disabled={activeIndex === items.length - 1}
                                        className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {lightboxItem && (
                    <Lightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
                )}
            </AnimatePresence>
        </>
    );
}
