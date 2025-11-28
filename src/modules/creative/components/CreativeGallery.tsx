import React from 'react';

export default function CreativeGallery() {
    return (
        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Placeholder Grid */}
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="aspect-square bg-[#1a1a1a] rounded-lg border border-gray-800 flex items-center justify-center hover:border-gray-600 transition-colors cursor-pointer">
                        <span className="text-gray-600 text-xs">Empty Slot {i}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
