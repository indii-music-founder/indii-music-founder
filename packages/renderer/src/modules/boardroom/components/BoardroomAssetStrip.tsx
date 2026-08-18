import React, { useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Image as ImageIcon, FileText, Music, Video, X, ExternalLink, Sparkles } from 'lucide-react';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import type { HistoryItem } from '@/core/types/history';

/**
 * BoardroomAssetStrip — a horizontal strip of the artist's most recent
 * generated assets, rendered inside the Boardroom conversation panel.
 *
 * ISSUE-1361 (Boardroom as in-page workspace): the founder should not need to
 * flip back to the Studio to see what the agents just created. Clicking an
 * asset opens an enlarged in-place preview (lightbox) so the user can actually
 * see the detail; an explicit "Open in Studio" action in the preview performs
 * the Studio handoff and confirms it with a toast — the handoff is never
 * silent.
 */
const MAX_ASSETS = 8;

function AssetIcon({ type }: { type: HistoryItem['type'] }) {
    switch (type) {
        case 'video': return <Video size={12} className="text-cyan-400" />;
        case 'music': return <Music size={12} className="text-green-400" />;
        case 'text': return <FileText size={12} className="text-amber-400" />;
        default: return <ImageIcon size={12} className="text-indigo-400" />;
    }
}

export const BoardroomAssetStrip: React.FC = () => {
    const { generatedHistory, openImageInStudio } = useStore(
        useShallow(state => ({
            generatedHistory: state.generatedHistory || [],
            openImageInStudio: state.openImageInStudio,
        })),
    );
    const toast = useToast();
    const [previewItem, setPreviewItem] = useState<HistoryItem | null>(null);

    const assets = generatedHistory
        .filter(item => item.url && item.url.startsWith('data:image') === false)
        .slice(0, MAX_ASSETS);

    const sendToStudio = useCallback((item: HistoryItem) => {
        if (item.type === 'image' && openImageInStudio) {
            openImageInStudio({
                imageId: item.id,
                sourceUrl: item.url,
                sourceMessageId: `boardroom-asset-${item.id}`,
                agentId: 'creative',
                prompt: item.prompt || 'Boardroom Asset',
            });
            toast.success(`"${(item.prompt || 'Asset').slice(0, 48)}" sent to Studio — open the Creative Studio to refine it.`);
            setPreviewItem(null);
            return;
        }
        // Non-image assets: open the URL in a new tab (docs/videos are
        // browser-renderable download URLs).
        window.open(item.url, '_blank', 'noopener,noreferrer');
        setPreviewItem(null);
    }, [openImageInStudio, toast]);

    const openPreview = useCallback((item: HistoryItem) => {
        setPreviewItem(item);
    }, []);

    if (assets.length === 0) return null;

    return (
        <div className="shrink-0 border-b border-white/5 px-4 py-2 bg-white/[0.02]">
            <div className="flex items-center gap-1.5 mb-1.5">
                <ImageIcon size={11} className="text-indigo-400" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                    Recent Assets
                </span>
                <span className="text-[9px] text-white/20 ml-1">(click to preview)</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" data-testid="boardroom-asset-strip">
                {assets.map(item => (
                    <button
                        key={item.id}
                        onClick={() => openPreview(item)}
                        className="group relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-white/10 hover:border-indigo-400/50 hover:scale-105 transition-all bg-black/40 flex items-center justify-center"
                        title={item.prompt || 'Asset'}
                        aria-label={`Preview ${item.prompt || 'asset'}`}
                        data-testid={`boardroom-asset-${item.id}`}
                    >
                        {item.type === 'image' ? (
                            <img
                                src={item.url}
                                alt={item.prompt || 'Generated asset'}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                    // Unresolved storage URIs must never leave a
                                    // broken image — fall back to an icon tile.
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            <AssetIcon type={item.type} />
                        )}
                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white/70 px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.type}
                        </span>
                    </button>
                ))}
            </div>

            {/* Enlarged in-place preview (lightbox) */}
            {previewItem && (
                <div
                    className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
                    onClick={() => setPreviewItem(null)}
                    data-testid="boardroom-asset-preview"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Preview: ${previewItem.prompt || 'Asset'}`}
                >
                    <div
                        className="relative max-w-3xl w-full bg-bg-dark border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                            <Sparkles size={13} className="text-indigo-400 shrink-0" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/60 truncate">
                                {previewItem.type} asset
                            </span>
                            <span className="ml-auto text-[10px] font-mono text-white/20 truncate max-w-[40%]">
                                {previewItem.prompt || ''}
                            </span>
                            <button
                                onClick={() => setPreviewItem(null)}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors shrink-0"
                                aria-label="Close preview"
                                data-testid="boardroom-asset-preview-close"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        <div className="flex items-center justify-center bg-black/60 p-4 max-h-[65vh] overflow-auto">
                            {previewItem.type === 'image' ? (
                                <img
                                    src={previewItem.url}
                                    alt={previewItem.prompt || 'Generated asset'}
                                    className="max-w-full max-h-[55vh] object-contain rounded-lg"
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-3 py-10 text-white/50">
                                    <AssetIcon type={previewItem.type} />
                                    <span className="text-xs">{previewItem.type} — not previewable inline</span>
                                </div>
                            )}
                        </div>

                        {previewItem.prompt && (
                            <div className="px-4 py-2 border-t border-white/5 text-xs text-white/50 max-h-20 overflow-y-auto">
                                {previewItem.prompt}
                            </div>
                        )}

                        <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5">
                            <button
                                onClick={() => sendToStudio(previewItem)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 transition-all text-xs font-bold uppercase tracking-wider"
                                data-testid="boardroom-asset-open-in-studio"
                            >
                                <ExternalLink size={12} />
                                Open in Studio
                            </button>
                            <button
                                onClick={() => setPreviewItem(null)}
                                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-all text-xs font-bold uppercase tracking-wider"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
