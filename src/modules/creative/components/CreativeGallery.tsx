import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { Play, Image as ImageIcon, Trash2, Maximize2 } from 'lucide-react';
import CreativeCanvas from './CreativeCanvas';

export default function CreativeGallery() {
    const { generatedHistory, removeFromHistory } = useStore();
    const [selectedItem, setSelectedItem] = useState<{ id: string; url: string; prompt: string; type: 'image' | 'video' } | null>(null);

    if (generatedHistory.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500 flex-col gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center">
                    <ImageIcon size={32} className="opacity-50" />
                </div>
                <p>Gallery is empty. Start creating!</p>
            </div>
        );
    }

    return (
        <>
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {generatedHistory.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setSelectedItem(item as any)}
                            className="group relative aspect-square bg-[#1a1a1a] rounded-lg border border-gray-800 overflow-hidden hover:border-gray-600 transition-all cursor-pointer"
                        >
                            {item.type === 'video' ? (
                                <video src={item.url} className="w-full h-full object-cover" loop muted onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                            ) : (
                                <img src={item.url} alt={item.prompt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            )}

                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                <p className="text-xs text-white line-clamp-2 mb-2">{item.prompt}</p>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-gray-400 uppercase">{item.type}</span>
                                    <div className="flex gap-1">
                                        <button className="p-1.5 bg-gray-800/50 text-white rounded hover:bg-gray-700 transition-colors">
                                            <Maximize2 size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeFromHistory(item.id); }}
                                            className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500 hover:text-white transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {item.type === 'video' && (
                                <div className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center pointer-events-none">
                                    <Play size={10} className="text-white ml-0.5" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Canvas Modal */}
            {selectedItem && (
                <CreativeCanvas item={selectedItem} onClose={() => setSelectedItem(null)} />
            )}
        </>
    );
}
