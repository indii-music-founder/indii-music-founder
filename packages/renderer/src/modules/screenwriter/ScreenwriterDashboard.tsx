import React from 'react';
import { PenTool } from 'lucide-react';

export default function ScreenwriterDashboard() {
    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative">
            <div className="px-6 py-8 border-b border-white/5 relative z-10 flex-shrink-0">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-linear-to-br from-purple-500 to-purple-400 rounded-lg shadow-lg shadow-purple-500/20">
                        <PenTool size={20} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Screenwriter Center</h1>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 relative z-10 custom-scrollbar">
                <p className="text-white">Screenwriter Agent coming soon...</p>
            </div>
        </div>
    );
}
