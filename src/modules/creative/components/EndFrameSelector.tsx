import React from 'react';
import { X } from 'lucide-react';
import { HistoryItem } from '@/core/store';

interface EndFrameSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    generatedHistory: HistoryItem[];
    currentItemId: string;
    onSelect: (item: HistoryItem) => void;
}

export const EndFrameSelector: React.FC<EndFrameSelectorProps> = ({
    isOpen,
    onClose,
    generatedHistory,
    currentItemId,
    onSelect
}) => {
    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 bg-black/80 z-10 flex flex-col p-8">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Select End Frame</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <X size={24} />
                </button>
            </div>
            <div className="grid grid-cols-4 gap-4 overflow-y-auto custom-scrollbar">
                {generatedHistory.filter(i => i.type === 'image' && i.id !== currentItemId).map(histItem => (
                    <button
                        key={histItem.id}
                        onClick={() => onSelect(histItem)}
                        className="relative aspect-square rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-colors group"
                    >
                        <img src={histItem.url} alt={histItem.prompt} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white font-bold">Select</span>
                        </div>
                    </button>
                ))}
                {generatedHistory.filter(i => i.type === 'image' && i.id !== currentItemId).length === 0 && (
                    <div className="col-span-4 text-center text-gray-500 py-12">
                        No other images found in history.
                    </div>
                )}
            </div>
        </div>
    );
};
