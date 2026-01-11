import React, { useRef } from 'react';
import { HistoryItem } from '@/core/store/slices/creativeSlice';

interface DailyItemProps {
    video: HistoryItem;
    isSelected: boolean;
    onSelect: (item: HistoryItem) => void;
    onDragStart: (e: React.DragEvent, item: HistoryItem) => void;
    /** Duration in seconds. Defaults to 4s if not provided. */
    duration?: number;
}

export const DailyItem = React.memo<DailyItemProps>(({
    video,
    isSelected,
    onSelect,
    onDragStart,
    duration = 4
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(video);
        }
    };

    const handleMouseEnter = () => {
        // ⚡ Bolt Optimization: Only play video on hover to save resources
        videoRef.current?.play().catch(() => {
            // Ignore auto-play errors (e.g. if user hasn't interacted with document yet)
        });
    };

    const handleMouseLeave = () => {
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0; // Reset to start
        }
    };

    const formattedDuration = `00:${duration.toString().padStart(2, '0')}`;
    const durationLabel = `${duration} seconds`;

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`Select video: ${video.prompt || 'Untitled video'}, Duration: ${durationLabel}`}
            aria-pressed={isSelected}
            onKeyDown={handleKeyDown}
            onClick={() => onSelect(video)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
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
                // ⚡ Bolt Optimization: Use preload="metadata" to avoid downloading full video until needed
                <video
                    ref={videoRef}
                    src={video.url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                    muted
                    playsInline
                    loop
                />
            )}

            {/* Duration Badge */}
            <div
                className="absolute bottom-1 right-1 bg-black/80 text-[8px] text-white px-1 rounded pointer-events-none"
                aria-hidden="true"
            >
                {formattedDuration}
            </div>
        </div>
    );
});

DailyItem.displayName = 'DailyItem';
