import React from 'react';
import { Server } from 'lucide-react';

export default function DevopsDashboard() {
    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative">
            <div className="px-6 py-8 border-b border-white/5 relative z-10 flex-shrink-0">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-linear-to-br from-blue-500 to-blue-400 rounded-lg shadow-lg shadow-blue-500/20">
                        <Server size={20} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">DevOps Center</h1>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 relative z-10 custom-scrollbar">
                <p className="text-white">DevOps Agent coming soon...</p>
            </div>
        </div>
    );
}
