import React, { useEffect, useState } from 'react';
import { Bot, ChevronDown, Sparkles } from 'lucide-react';
import { agentRegistry } from '@/services/agent/registry';
import type { SpecializedAgent } from '@/services/agent/types';

interface SpecialistSelectorProps {
    selectedAgentId: string | null;
    onSelect: (agentId: string | null) => void;
}

export const SpecialistSelector: React.FC<SpecialistSelectorProps> = ({
    selectedAgentId,
    onSelect,
}) => {
    const [agents, setAgents] = useState<SpecializedAgent[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        // Load registered agents — warmup may already have run
        try {
            const all = agentRegistry.getAll();
            setAgents(all);
        } catch {
            // Registry not warmed up yet — try after a delay
            setTimeout(() => {
                try {
                    setAgents(agentRegistry.getAll());
                } catch {
                    // silently fail — no agents available
                }
            }, 1000);
        }
    }, []);

    const selectedAgent = agents.find(a => a.id === selectedAgentId);

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(prev => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-300 hover:border-emerald-500/50 hover:text-white transition-all duration-200"
                title="Select specialist agent"
            >
                <Bot size={14} className="text-emerald-400 shrink-0" />
                <span className="max-w-[120px] truncate">
                    {selectedAgent ? selectedAgent.name : 'Auto'}
                </span>
                <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpen(false)}
                    />
                    {/* Dropdown */}
                    <div className="absolute top-full left-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                        <div className="p-2 space-y-0.5">
                            {/* Auto option */}
                            <button
                                onClick={() => { onSelect(null); setOpen(false); }}
                                className={`w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                                    selectedAgentId === null
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <Sparkles size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                                <div>
                                    <div className="text-sm font-medium">Auto</div>
                                    <div className="text-xs text-slate-500">Route to best specialist</div>
                                </div>
                            </button>

                            {agents.length > 0 && (
                                <div className="border-t border-slate-800 mt-1 pt-1">
                                    {agents.map(agent => (
                                        <button
                                            key={agent.id}
                                            onClick={() => { onSelect(agent.id); setOpen(false); }}
                                            className={`w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                                                selectedAgentId === agent.id
                                                    ? 'bg-emerald-500/20 text-emerald-300'
                                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                            }`}
                                        >
                                            <Bot size={14} className="mt-0.5 shrink-0" />
                                            <div>
                                                <div className="text-sm font-medium">{agent.name}</div>
                                                {agent.description && (
                                                    <div className="text-xs text-slate-500 line-clamp-1">
                                                        {agent.description}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
