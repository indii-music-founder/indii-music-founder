import React from 'react';
import { MoreHorizontal, Film } from 'lucide-react';
import { HistoryItem } from '@/core/store/slices/creativeSlice';
import { DailyItem } from './DailyItem';

interface DailiesStripProps {
    items: HistoryItem[];
    selectedId: string | null;
    onSelect: (item: HistoryItem) => void;
    onDragStart: (e: React.DragEvent, item: HistoryItem) => void;
}

export const DailiesStrip: React.FC<DailiesStripProps> = ({
    items,
    selectedId,
    onSelect,
    onDragStart
}) => {
    // Filter only videos (and maybe images if needed, but "Dailies" implies footage)
    const videos = items.filter(item => item.type === 'video');

    if (videos.length === 0) return null;

    return (
        <div
            className="absolute bottom-6 left-6 right-6 h-32 glass rounded-xl border border-white/10 flex flex-col pointer-events-auto overflow-hidden z-20"
            role="region"
            aria-label="Dailies Bin"
            data-testid="dailies-strip"
        >
            {/* Header */}
            <div className="h-8 px-3 flex items-center justify-between border-b border-white/5 bg-black/20">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-2">
                    <Film size={12} className="text-yellow-500" aria-hidden="true" />
                    Dailies Bin ({videos.length})
                </span>
                <button
                    className="text-gray-600 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-white/50 outline-none rounded-sm"
                    aria-label="Dailies Options"
                    data-testid="dailies-options-btn"
                >
                    <MoreHorizontal size={14} aria-hidden="true" />
                </button>
            </div>

            {/* Strip */}
            <div
                className="flex-1 overflow-x-auto custom-scrollbar flex items-center px-2 gap-2"
                role="list"
                aria-label="Recent video generations"
            >
                {videos.map((video) => (
                    <div key={video.id} role="listitem" className="flex-shrink-0">
                        <DailyItem
                            video={video}
                            isSelected={selectedId === video.id}
                            onSelect={onSelect}
                            onDragStart={onDragStart}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
