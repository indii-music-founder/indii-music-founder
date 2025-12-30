import React from 'react';

// A CSS-only animated radar/map visualization
export const ScoutMapVisualization: React.FC<{ status: string }> = ({ status }) => {
    return (
        <div className="relative w-full h-64 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col items-center justify-center shadow-inner group">

            {/* Grid Background */}
            <div className="absolute inset-0 opacity-20"
                style={{
                    backgroundImage: 'linear-gradient(#10b981 1px, transparent 1px), linear-gradient(90deg, #10b981 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    maskImage: 'radial-gradient(circle at center, black 40%, transparent 80%)'
                }}
            />

            {/* Scanning Radar Line */}
            <div className="absolute inset-0 animate-[spin_4s_linear_infinite]">
                <div className="w-full h-1/2 bg-gradient-to-t from-emerald-500/20 to-transparent border-b border-emerald-500/50 origin-bottom transform rotate-0" />
            </div>

            {/* Central Pulse */}
            <div className="relative z-10 flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20" />
                    <div className="w-4 h-4 bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)] border border-emerald-300" />
                </div>

                <div className="bg-slate-950/80 backdrop-blur border border-emerald-500/30 px-6 py-2 rounded-full flex items-center gap-3 shadow-xl">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-emerald-400 font-mono text-xs tracking-wider uppercase">
                        {status}
                    </span>
                </div>
            </div>

            {/* Decorative Blips */}
            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-emerald-500/40 rounded-full animate-pulse delay-75" />
            <div className="absolute bottom-1/3 right-1/4 w-1.5 h-1.5 bg-emerald-400/30 rounded-full animate-pulse delay-150" />
            <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-white/20 rounded-full" />

        </div>
    );
};
