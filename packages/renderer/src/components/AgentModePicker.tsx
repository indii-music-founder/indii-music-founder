import React from 'react';
import { useStore } from '@/core/store';
import { DEPARTMENTS } from '@/services/agent/departments';
import { VALID_AGENT_IDS } from '@/services/agent/types';
type ConversationMode = 'direct' | 'department' | 'boardroom';
import { motion, AnimatePresence } from 'motion/react';
import { Users, User, LayoutGrid, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShallow } from 'zustand/react/shallow';

/**
 * AgentModePicker — Three-mode hybrid hierarchical agent selector.
 * Allows switching between Boardroom (All Heads), Department (Vertical Swarm),
 * and Direct (Solo Agent) modes.
 */
interface AgentModePickerProps {
    className?: string;
    mode?: ConversationMode;
    onModeChange?: (mode: ConversationMode) => void;
    departmentId?: string | null;
    onDepartmentChange?: (deptId: string | null) => void;
    agentId?: string | null;
    onAgentChange?: (agentId: string | null) => void;
}

export function AgentModePicker({ 
    className,
    mode: controlledMode,
    onModeChange,
    departmentId: controlledDeptId,
    onDepartmentChange,
    agentId: controlledAgentId,
    onAgentChange
}: AgentModePickerProps) {
    const store = useStore(useShallow(state => ({
        conversationMode: state.conversationMode,
        activeDepartmentId: state.activeDepartmentId,
        directTargetAgentId: state.directTargetAgentId,
        setConversationMode: state.setConversationMode,
        setActiveDepartmentId: state.setActiveDepartmentId,
        setDirectTargetAgentId: state.setDirectTargetAgentId,
    })));

    // Use controlled props if provided, otherwise fallback to store
    const conversationMode = controlledMode ?? store.conversationMode;
    const activeDepartmentId = controlledDeptId ?? store.activeDepartmentId;
    const directTargetAgentId = controlledAgentId ?? store.directTargetAgentId;

    const setConversationMode = onModeChange ?? store.setConversationMode;
    const setActiveDepartmentId = onDepartmentChange ?? store.setActiveDepartmentId;
    const setDirectTargetAgentId = onAgentChange ?? store.setDirectTargetAgentId;

    const modes = [
        { id: 'boardroom', label: 'Boardroom', icon: LayoutGrid, desc: 'Multi-dept swarm' },
        { id: 'department', label: 'Department', icon: Users, desc: 'Single dept swarm' },
        { id: 'direct', label: 'Direct', icon: User, desc: 'Solo agent chat' },
    ] as const;

    return (
        <div className={cn("flex flex-col gap-3 p-1 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-xl shadow-2xl", className)}>
            {/* Mode Segmented Switch */}
            <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 relative overflow-hidden">
                {modes.map((mode) => {
                    const isActive = conversationMode === mode.id;
                    const Icon = mode.icon;
                    return (
                        <button
                            key={mode.id}
                            onClick={() => setConversationMode(mode.id)}
                            className={cn(
                                "flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all duration-300 relative z-10",
                                isActive ? "text-white" : "text-white/40 hover:text-white/70"
                            )}
                        >
                            <Icon className={cn("w-4 h-4 mb-1", isActive ? "text-blue-400" : "text-inherit")} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">{mode.label}</span>
                            
                            {isActive && (
                                <motion.div
                                    layoutId="mode-pill"
                                    className="absolute inset-0 bg-white/10 rounded-lg -z-10 border border-white/10"
                                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Contextual Selectors */}
            <AnimatePresence mode="wait">
                {conversationMode === 'department' && (
                    <motion.div
                        key="dept-selector"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="px-1 pb-1"
                    >
                        <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1.5 ml-1">Select Department</div>
                        <div className="grid grid-cols-2 gap-1.5 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                            {Object.values(DEPARTMENTS).map((dept) => {
                                const isSelected = activeDepartmentId === dept.id;
                                return (
                                    <button
                                        key={dept.id}
                                        onClick={() => setActiveDepartmentId(dept.id)}
                                        className={cn(
                                            "flex flex-col p-2 rounded-xl text-left border transition-all duration-200",
                                            isSelected 
                                                ? "bg-blue-600/20 border-blue-500/50 text-white" 
                                                : "bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:border-white/10"
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold truncate">{dept.displayName}</span>
                                            {isSelected && <Check className="w-3 h-3 text-blue-400" />}
                                        </div>
                                        <span className="text-[8px] opacity-60 truncate">Head: {dept.headId}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {conversationMode === 'direct' && (
                    <motion.div
                        key="direct-selector"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="px-1 pb-1"
                    >
                        <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1.5 ml-1">Select Agent</div>
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                            <div className="flex flex-col gap-3">
                                {Object.values(DEPARTMENTS).map((dept) => {
                                    // Combine head and workers for this dept, and filter by VALID_AGENT_IDS to be safe
                                    const agentsInDept = [dept.headId, ...dept.workerIds].filter(id => 
                                        (VALID_AGENT_IDS as readonly string[]).includes(id)
                                    );
                                    
                                    if (agentsInDept.length === 0) return null;

                                    return (
                                        <div key={dept.id} className="flex flex-col gap-1">
                                            <div className="text-[8px] font-bold text-blue-400/50 uppercase tracking-wider mb-1 px-1">{dept.displayName}</div>
                                            <div className="grid grid-cols-1 gap-1">
                                                {agentsInDept.map((agentId) => {
                                                    const isSelected = directTargetAgentId === agentId;
                                                    return (
                                                        <button
                                                            key={agentId}
                                                            onClick={() => setDirectTargetAgentId(agentId)}
                                                            className={cn(
                                                                "flex items-center justify-between p-2 rounded-lg border transition-all duration-200",
                                                                isSelected 
                                                                    ? "bg-purple-600/20 border-purple-500/50 text-white" 
                                                                    : "bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:border-white/10"
                                                            )}
                                                        >
                                                            <div className="flex flex-col text-left">
                                                                <span className="text-[11px] font-semibold">{agentId}</span>
                                                                <span className="text-[8px] opacity-40">{agentId === dept.headId ? 'Department Head' : 'Specialist Worker'}</span>
                                                            </div>
                                                            {isSelected && <Check className="w-3 h-3 text-purple-400" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}

                {conversationMode === 'boardroom' && (
                    <motion.div
                        key="boardroom-info"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="px-3 py-4 text-center"
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center mx-auto mb-2 border border-blue-500/20">
                            <LayoutGrid className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="text-[11px] font-bold text-white/80 mb-1">Boardroom Active</div>
                        <p className="text-[10px] text-white/40 max-w-[180px] mx-auto leading-relaxed">
                            Full swarm mode. 21 department heads collaborate freely on your project.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default AgentModePicker;
