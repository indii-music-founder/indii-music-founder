import React from 'react';
import { useStore } from '@/core/store';

export default function CreativeHistory() {
    // Mock history for now, will connect to store later
    const historyItems = [
        { id: '1', prompt: 'A futuristic city', type: 'image', timestamp: Date.now() },
        { id: '2', prompt: 'Cyberpunk character', type: 'image', timestamp: Date.now() - 10000 },
    ];

    return (
        <div className="flex flex-col h-full">
            {historyItems.map(item => (
                <div key={item.id} className="p-2 border-b border-gray-800 hover:bg-gray-800 cursor-pointer transition-colors group">
                    <div className="w-full h-24 bg-gray-700 rounded mb-2 overflow-hidden relative">
                        {/* Placeholder for image */}
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">Image</div>
                    </div>
                    <p className="text-[10px] text-gray-400 line-clamp-2 group-hover:text-white">{item.prompt}</p>
                    <span className="text-[9px] text-gray-600">{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
            ))}
        </div>
    );
}
