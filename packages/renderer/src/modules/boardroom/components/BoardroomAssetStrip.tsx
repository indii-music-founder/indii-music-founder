import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Image, FileText, Music, Video } from 'lucide-react';
import { useStore } from '@/core/store';
import type { HistoryItem } from '@/core/types/history';

/**
 * BoardroomAssetStrip — a horizontal strip of the artist's most recent
 * generated assets, rendered inside the Boardroom conversation panel.
 *
 * ISSUE-1361 (Boardroom as in-page workspace): the founder should not need
 * to flip back to the Studio to see what the agents just created. This strip
 * shows the latest generated images/documents/videos inline; clicking an
 * asset opens it in the Studio editor.
 */
const MAX_ASSETS = 8;

function AssetIcon({ type }: { type: HistoryItem['type'] }) {
    switch (type) {
        case 'video': return <Video size={12} className="text-cyan-400" />;
        case 'music': return <Music size={12} className="text-green-400" />;
        case 'text': return <FileText size={12} className="text-amber-400" />;
        default: return <Image size={12} className="text-indigo-400" />;
    }
}

export const BoardroomAssetStrip: React.FC = () => {
    const { generatedHistory, openImageInStudio } = useStore(
        useShallow(state => ({
            generatedHistory: state.generatedHistory || [],
            openImageInStudio: state.openImageInStudio,
        })),
    );

    const assets = generatedHistory
        .filter(item => item.url && item.url.startsWith('data:image') === false)
        .slice(0, MAX_ASSETS);

    if (assets.length === 0) return null;

    const openAsset = (item: HistoryItem) => {
        if (item.type === 'image' && openImageInStudio) {
            openImageInStudio({
                imageId: item.id,
                sourceUrl: item.url,
                sourceMessageId: `boardroom-asset-${item.id}`,
                agentId: 'creative',
                prompt: item.prompt || 'Boardroom Asset',
            });
            return;
        }
        // Non-image assets: open the URL in a new tab (docs/videos are
        // browser-renderable download URLs).
        window.open(item.url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="shrink-0 border-b border-white/5 px-4 py-2 bg-white/[0.02]">
            <div className="flex items-center gap-1.5 mb-1.5">
                <Image size={11} className="text-indigo-400" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                    Recent Assets
                </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" data-testid="boardroom-asset-strip">
                {assets.map(item => (
                    <button
                        key={item.id}
                        onClick={() => openAsset(item)}
                        className="group relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-white/10 hover:border-indigo-400/50 hover:scale-105 transition-all bg-black/40 flex items-center justify-center"
                        title={item.prompt || 'Asset'}
                        aria-label={`Open ${item.prompt || 'asset'} in Studio`}
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
        </div>
    );
};
