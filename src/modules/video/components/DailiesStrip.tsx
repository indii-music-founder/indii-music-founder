import React from 'react';
import { Play, MoreHorizontal, Film } from 'lucide-react';
import { HistoryItem } from '@/core/store/slices/creativeSlice';

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
        <div className="absolute bottom-6 left-6 right-6 h-32 glass rounded-xl border border-white/10 flex flex-col pointer-events-auto overflow-hidden z-20">
            {/* Header */}
            <div className="h-8 px-3 flex items-center justify-between border-b border-white/5 bg-black/20">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-2">
                    <Film size={12} className="text-yellow-500" />
                    Dailies Bin ({videos.length})
                </span>
                <button className="text-gray-600 hover:text-white transition-colors">
                    <MoreHorizontal size={14} />
                </button>
            </div>

            {/* Strip */}
            <div className="flex-1 overflow-x-auto custom-scrollbar flex items-center px-2 gap-2">
                {videos.map((video) => (
                    <div
                        key={video.id}
                        onClick={() => onSelect(video)}
                        draggable
                        onDragStart={(e) => onDragStart(e, video)}
                        className={`
                            relative h-20 aspect-video rounded-lg overflow-hidden cursor-pointer group flex-shrink-0 transition-all border-2
                            ${selectedId === video.id
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
                ))}
            </div>
        </div>
    );
};
