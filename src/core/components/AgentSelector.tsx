import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { Check, Search, UserPlus, X, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion';

export const AgentSelector = ({ onClose }: { onClose: () => void }) => {
    const activeSessionId = useStore(state => state.activeSessionId);
    const sessions = useStore(state => state.sessions);
    const addParticipant = useStore(state => state.addParticipant);
    const availableAgents = useStore(state => state.availableAgents);
    const isLoadingAgents = useStore(state => state.isLoadingAgents);
    const agentsError = useStore(state => state.agentsError);
    const loadAgents = useStore(state => state.loadAgents);

    useEffect(() => {
        loadAgents();
    }, [loadAgents]);

    // Safety check
    const currentSession = activeSessionId ? sessions[activeSessionId] : null;
    const currentParticipants = currentSession?.participants || [];

    const [searchTerm, setSearchTerm] = useState('');

    const filteredAgents = availableAgents.filter(agent =>
        (agent.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (agent.category || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleInvite = (agentId: string) => {
        if (!activeSessionId) return;
        addParticipant(activeSessionId, agentId);
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute top-16 right-0 w-[90vw] max-w-[380px] origin-top-right z-50 rounded-3xl overflow-hidden border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]"
            style={{
                background: 'rgba(10, 10, 14, 0.95)',
                backdropFilter: 'blur(40px) saturate(200%)'
            }}
        >
            <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,1)] animate-pulse" />
                        Council Directory
                    </h4>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="relative group">
                    <div className="absolute inset-0 bg-purple-500/5 blur-xl group-focus-within:bg-purple-500/10 transition-all"></div>
                    <Search size={14} className="absolute left-3.5 top-3 text-gray-500" />
                    <input
                        type="text"
                        placeholder="SUMMON SPECIALIST..."
                        className="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/5 transition-all font-mono tracking-tight"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>
            </div>

            <div className="p-4 max-h-[420px] overflow-y-auto custom-scrollbar grid grid-cols-1 gap-3 min-h-[200px]">
                {isLoadingAgents ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3 py-12">
                        <Loader2 size={24} className="animate-spin text-purple-500" />
                        <span className="text-xs uppercase tracking-wider">Summoning Agents...</span>
                    </div>
                ) : agentsError ? (
                    <div className="flex flex-col items-center justify-center h-full text-red-400 gap-3 text-center px-4 py-12">
                        <AlertCircle size={24} />
                        <span className="text-xs">{agentsError}</span>
                    </div>
                ) : (
                    filteredAgents.map((agent, index) => {
                        const isPresent = currentParticipants.includes(agent.id);

                        return (
                            <motion.div
                                key={agent.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                whileHover={isPresent ? {} : { scale: 1.01, backgroundColor: 'rgba(255,255,255,0.04)' }}
                                whileTap={isPresent ? {} : { scale: 0.99 }}
                                className={`relative p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between group ${isPresent
                                    ? 'bg-purple-500/5 border-purple-500/20 mix-blend-screen opacity-60'
                                    : 'bg-white/5 border-white/5 hover:border-white/10 cursor-pointer shadow-sm'
                                    }`}
                                onClick={() => !isPresent && handleInvite(agent.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500 ${isPresent ? 'bg-purple-500/20 border-purple-500/40' : 'bg-black/40 border-white/10 group-hover:border-purple-500/30'}`}>
                                        <Sparkles size={16} className={isPresent ? 'text-purple-300' : 'text-gray-500 group-hover:text-purple-400'} />
                                    </div>
                                    <div>
                                        <div className="text-[13px] font-bold text-gray-200 tracking-tight">{agent.name}</div>
                                        <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{agent.category}</div>
                                    </div>
                                </div>

                                {isPresent ? (
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/20">
                                        <Check size={10} strokeWidth={3} />
                                        ACTIVE
                                    </div>
                                ) : (
                                    <motion.div
                                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 p-2 rounded-lg text-white"
                                    >
                                        <UserPlus size={14} />
                                    </motion.div>
                                )}
                            </motion.div>
                        );
                    })
                )}
            </div>

            <div className="p-4 bg-white/[0.01] border-t border-white/5 flex justify-center">
                <p className="text-[9px] text-gray-600 uppercase font-bold tracking-[0.3em]">Select agent to initialize context</p>
            </div>
        </motion.div>
    );
};
