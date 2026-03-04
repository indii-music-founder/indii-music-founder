import React from 'react';
import { Network } from 'lucide-react';
import { StatusPill } from './StatusPill';

interface AgentHeaderProps {
    uptime: string;
    isProcessing: boolean;
}

export function AgentHeader({ uptime, isProcessing }: AgentHeaderProps) {
    return (
        <header className="h-20 flex-shrink-0 border-b border-white/5 bg-black/20 backdrop-blur-xl px-10 flex items-center justify-between z-40">
            <div className="flex items-center gap-6">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-dept-marketing to-purple-600 flex items-center justify-center shadow-lg shadow-dept-marketing/20 border border-white/10">
                    <Network size={22} className="text-white" />
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-xl font-black text-white tracking-tighter uppercase italic">Agent Zero</h2>
                        <div className="px-2 py-0.5 rounded-full bg-dept-marketing/10 border border-dept-marketing/20 flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-dept-marketing animate-pulse" />
                            <span className="text-[9px] font-black text-dept-marketing uppercase tracking-widest">Active Link</span>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-0.5">Neural Orchestrator V3.1 • Global</p>
                </div>
            </div>

            <div className="hidden md:flex items-center gap-12">
                <StatusPill label="Logic Core" status="Gemini 3 Pro" />
                <StatusPill label="Status" status={isProcessing ? 'Thinking' : 'Standby'} />
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Session Uptime</span>
                    <span className="text-[11px] font-bold text-white uppercase italic tracking-tighter tabular-nums mt-0.5">{uptime}</span>
                </div>
            </div>
        </header>
    );
}
