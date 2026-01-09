import React from 'react';
import { useStore } from '@/core/store';
import { HistoryItem } from '@/core/store/slices/creativeSlice';
import { Image, Film, Music, FileText } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';

interface EditorAssetLibraryProps {
    onDragStart: (e: React.DragEvent, item: HistoryItem) => void;
}

export const EditorAssetLibrary: React.FC<EditorAssetLibraryProps> = ({ onDragStart }) => {
    const history = useStore((state) => state.generatedHistory);

    // Filter for supported types
    const assets = history.filter((item: HistoryItem) =>
        ['image', 'video', 'audio'].includes(item.type)
    );

    const getIcon = (type: string) => {
        switch (type) {
            case 'video': return <Film size={16} />;
            case 'audio': return <Music size={16} />;
            case 'image': return <Image size={16} />;
            default: return <FileText size={16} />;
        }
    };

    const EmptyState = () => (
        <div className="text-center py-8 text-gray-500 text-xs">
            No assets found in history.
            <br />
            Generate some content first!
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-gray-900 border-r border-gray-800 w-64">
            <div className="p-4 border-b border-gray-800">
                <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Asset Library</h3>
                <p className="text-xs text-gray-500 mt-1">Drag items to the timeline</p>
            </div>

            <div className="flex-1 p-2">
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
                                className="group relative bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 cursor-grab active:cursor-grabbing transition-all mb-2"
                            >
                                <div className="aspect-video bg-gray-950 relative">
                                    {item.type === 'image' || item.type === 'video' ? (
                                        <img
                                            src={item.url}
                                            alt={item.prompt}
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                                            <Music size={24} />
                                        </div>
                                    )}
                                    <div className="absolute top-1 right-1 bg-black/60 p-1 rounded text-white">
                                        {getIcon(item.type)}
                                    </div>
                                </div>
                                <div className="p-2">
                                    <p className="text-xs text-gray-300 truncate" title={item.prompt}>
                                        {item.prompt || 'Untitled Asset'}
                                    </p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">
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
