import React from 'react';
import { StatusPill } from './StatusPill';
import { IndiiFavicon } from '@/components/shared/IndiiFavicon';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import type { StoreState } from '@/core/store';

interface AgentHeaderProps {
    uptime: string;
    isProcessing: boolean;
}

export function AgentHeader({ uptime, isProcessing }: AgentHeaderProps) {
    const isOffline = useStore(useShallow((state: StoreState) => state.isOffline));
    const hasApiKey = !!import.meta.env.VITE_API_KEY;

    return (
        <header className="h-20 flex-shrink-0 border-b border-white/5 bg-black/20 backdrop-blur-xl px-10 flex items-center justify-between z-40">
            <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/40 to-purple-600/40 flex items-center justify-center shadow-lg shadow-indigo-500/10 border border-white/10 overflow-hidden">
                    <IndiiFavicon size={26} />
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-xl font-semibold text-white tracking-wide">indiiOS</h2>
                        {isOffline ? (
                            <div className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 flex items-center gap-1.5" title="No Internet Connection">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                <span className="text-[10px] font-medium text-red-400 uppercase tracking-widest">Offline</span>
                            </div>
                        ) : !hasApiKey ? (
                            <div className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-1.5" title="Missing Gemini API Key">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                <span className="text-[10px] font-medium text-amber-400 uppercase tracking-widest">API Missing</span>
                            </div>
                        ) : (
                            <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5" title="AI Engine Connected">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-widest">Online</span>
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-indigo-200/60 font-medium uppercase tracking-[0.1em] mt-0.5">AI Orchestrator</p>
                </div>
            </div>

            <div className="hidden md:flex items-center gap-12">
                <StatusPill label="Status" status={isProcessing ? 'Thinking' : 'Standby'} />
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Session Uptime</span>
                    <span className="text-[11px] font-bold text-white uppercase italic tracking-tighter tabular-nums mt-0.5">{uptime}</span>
                </div>
            </div>
        </header>
    );
}
