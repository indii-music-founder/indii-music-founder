import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { Plus, Bot } from 'lucide-react';
import { AgentSelector } from './AgentSelector';

export const AgentSwitcherStrip = () => {
    const [showSelector, setShowSelector] = useState(false);
    
    const {
        activeSessionId,
        sessions,
        availableAgents,
        agentMode
    } = useStore(
        useShallow(state => ({
            activeSessionId: state.activeSessionId,
            sessions: state.sessions,
            availableAgents: state.availableAgents,
            agentMode: state.agentMode
        }))
    );

    const currentSession = activeSessionId ? sessions[activeSessionId] : null;
    const participants = currentSession?.participants || [];
    
    // If no participants, we might just show indii
    if (participants.length === 0) return null;

    const activeAgents = participants
        .map(id => availableAgents.find(a => a.id === id))
        .filter((a): a is NonNullable<typeof a> => !!a);

    return (
        <div className="flex items-center gap-1 relative">
            {activeAgents.length > 0 ? (
                <div className="flex items-center -space-x-2 mr-2">
                    {activeAgents.slice(0, 3).map((agent, i) => (
                        <div 
                            key={agent.id}
                            className="w-6 h-6 rounded-full bg-gray-800 border-2 border-[#0a0a0e] flex items-center justify-center relative group"
                            style={{ zIndex: 10 - i, backgroundColor: agent.color ? `color-mix(in srgb, ${agent.color} 20%, #1f2937)` : undefined }}
                            title={agent.name}
                        >
                            <span className="text-[10px] font-bold text-white">{agent.name.charAt(0)}</span>
                        </div>
                    ))}
                    {activeAgents.length > 3 && (
                        <div className="w-6 h-6 rounded-full bg-gray-800 border-2 border-[#0a0a0e] flex items-center justify-center relative z-0 text-[9px] font-bold text-gray-400">
                            +{activeAgents.length - 3}
                        </div>
                    )}
                </div>
            ) : null}

            <button 
                onClick={() => setShowSelector(!showSelector)}
                className="w-6 h-6 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                title="Summon Specialist"
            >
                <Plus size={12} />
            </button>

            {showSelector && (
                <AgentSelector onClose={() => setShowSelector(false)} />
            )}
        </div>
    );
};
