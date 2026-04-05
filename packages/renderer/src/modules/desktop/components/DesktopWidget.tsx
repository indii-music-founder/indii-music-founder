import React from 'react';
import { Activity, Bot } from 'lucide-react';

export const DesktopWidget: React.FC = () => {
    // Mock Widget System (Item 170)
    // Simulating a macOS/Windows desktop widget
    return (
        <div className="w-[300px] h-[160px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col justify-between overflow-hidden relative group cursor-pointer transition-all hover:bg-black/70">
            {/* Background ambient glow */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/20 blur-3xl rounded-full pointer-events-none" />

            <div className="flex justify-between items-start z-10">
                <div>
                    <h3 className="text-xs text-white/50 font-medium uppercase tracking-wider mb-1">Daily Streams</h3>
                    <p className="text-3xl font-bold text-white tracking-tight">14,208</p>
                </div>
                <div className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                    <Activity size={12} /> +12%
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3 z-10">
                <div className="bg-purple-500/20 p-2 rounded-lg">
                    <Bot size={16} className="text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/50 mb-0.5">Next Agent Task</p>
                    <p className="text-sm text-white font-medium truncate">Draft Spotify Pitch</p>
                </div>
            </div>
        </div>
    );
};
