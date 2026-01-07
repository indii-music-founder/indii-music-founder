import React from 'react';
import { Play } from 'lucide-react';
import { HistoryItem } from '@/core/store/slices/creativeSlice';

interface DailyItemProps {
    video: HistoryItem;
    isSelected: boolean;
    onSelect: (item: HistoryItem) => void;
    onDragStart: (e: React.DragEvent, item: HistoryItem) => void;
}

export const DailyItem = React.memo<DailyItemProps>(({
    video,
    isSelected,
    onSelect,
    onDragStart
}) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(video);
        }
    };

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`Select video: ${video.prompt || 'Untitled video'}`}
            aria-pressed={isSelected}
            onKeyDown={handleKeyDown}
            onClick={() => onSelect(video)}
            draggable
            onDragStart={(e) => onDragStart(e, video)}
            className={`
                relative h-20 aspect-video rounded-lg overflow-hidden cursor-pointer group flex-shrink-0 transition-all border-2
                focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:outline-none
                ${isSelected
                    ? 'border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)] scale-105 z-10'
                    : 'border-transparent hover:border-white/20 hover:scale-105'
                }
            `}
        >
            {video.url.startsWith('data:image') || video.url.includes('placehold') ? (
                <img src={video.url} alt={video.prompt} className="w-full h-full object-cover" />
            ) : (
                <video src={video.url} className="w-full h-full object-cover" />
            )}

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play size={16} className="text-white fill-white" />
            </div>

            {/* Duration Badge (Mock) */}
            <div className="absolute bottom-1 right-1 bg-black/80 text-[8px] text-white px-1 rounded">
                00:04
            </div>
        </div>
    );
});

DailyItem.displayName = 'DailyItem';
