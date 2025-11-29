import React from 'react';
import { useStore } from '@/core/store';
import { Play } from 'lucide-react';

export default function CreativeHistory() {
    const { generatedHistory } = useStore();

    if (generatedHistory.length === 0) {
        return <div className="p-4 text-xs text-gray-500 text-center">No history yet.</div>;
    }

    return (
        <div className="flex flex-col h-full">
            {generatedHistory.map(item => (
                <div key={item.id} className="p-3 border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors group">
                    <div className="w-full aspect-video bg-gray-900 rounded mb-2 overflow-hidden relative border border-gray-800 group-hover:border-gray-600">
                        {item.type === 'video' ? (
                            <video src={item.url} className="w-full h-full object-cover" />
                        ) : (
                            <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                        )}
                        {item.type === 'video' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                    <Play size={10} className="text-white ml-0.5" />
                                </div>
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-400 line-clamp-2 group-hover:text-gray-200 leading-relaxed">{item.prompt}</p>
                    <div className="flex justify-between items-center mt-1">
                        <span className="text-[9px] text-gray-600 uppercase tracking-wider">{item.type}</span>
                        <span className="text-[9px] text-gray-600">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
