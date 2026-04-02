import React from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { HistoryItem } from '@/core/store/slices/creative';
import { Image, Film, Music, FileText } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';

interface EditorAssetLibraryProps {
    onDragStart: (e: React.DragEvent, item: HistoryItem) => void;
}

const EmptyState = () => (
    <div className="text-center py-8 text-gray-500 text-xs">
        No assets found in history.
        <br />
        Generate some content first!
    </div>
);

export const EditorAssetLibrary: React.FC<EditorAssetLibraryProps> = ({ onDragStart }) => {
    const { history } = useStore(useShallow((state) => ({
        history: state.generatedHistory
    })));

    // Filter for supported types
    const assets = history.filter((item: HistoryItem) =>
        ['image', 'video', 'audio'].includes(item.type)
    );

    const getIcon = (type: string) => {
        switch (type) {
            case 'video': return <Film size={12} />;
            case 'audio': return <Music size={12} />;
            case 'image': return <Image size={12} />;
            default: return <FileText size={12} />;
        }
    };



    return (
        <div className="h-full flex flex-col bg-[#050505] border-r border-[#1a1a1a] w-full">
            <div className="p-3 border-b border-[#1a1a1a] bg-[#0a0a0a]">
                <h3 className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Asset Library</h3>
                <p className="text-[9px] text-gray-500 mt-0.5">Drag to timeline</p>
            </div>

            <div className="flex-1 p-2 overflow-y-auto">
                {assets.length === 0 ? (
                    <EmptyState />
                ) : (
                    <Virtuoso
                        style={{ height: '100%' }}
                        data={assets}
                        itemContent={(index, item) => (
                            <div
                                key={item.id}
                                draggable
                                onDragStart={(e) => onDragStart(e, item)}
                                className="group relative bg-[#0a0a0a] rounded-md overflow-hidden border border-white/5 hover:border-blue-500/50 cursor-grab active:cursor-grabbing transition-all mb-2 flex flex-col"
                            >
                                <div className="aspect-video relative">
                                    {item.type === 'video' ? (
                                        <video
                                            src={item.url}
                                            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                                            preload="metadata"
                                            muted
                                            loop
                                            playsInline
                                            onMouseEnter={(e) => e.currentTarget.play().catch(() => { })}
                                            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                        />
                                    ) : item.type === 'image' ? (
                                        <img
                                            src={item.thumbnailUrl || item.url}
                                            alt={item.prompt}
                                            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gray-900/50">
                                            <Music size={14} />
                                        </div>
                                    )}
                                    <div className="absolute top-1 right-1 bg-black/80 px-1 py-0.5 rounded text-white flex items-center justify-center">
                                        {getIcon(item.type)}
                                    </div>
                                </div>
                                <div className="px-2 py-1.5 bg-[#0a0a0a]">
                                    <p className="text-[10px] font-medium text-gray-300 truncate leading-tight" title={item.prompt}>
                                        {item.prompt || 'Untitled Asset'}
                                    </p>
                                    <p className="text-[9px] text-gray-600 mt-0.5">
                                        {new Date(item.timestamp).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        )}
                    />
                )}
            </div>
        </div>
    );
};
