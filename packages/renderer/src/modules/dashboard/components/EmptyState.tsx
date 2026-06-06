import React, { useEffect, useState } from 'react';
import { Logger } from '@/core/logger/Logger';
import { motion } from 'motion/react';
import {
    MousePointer2,
    Eye,
    Play,
    Command,
    PenTool,
    Image,
    MapPin,
    Megaphone,
    FileCheck,
    TrendingUp,
    Network,
    MessageSquare,
    Zap,
} from 'lucide-react';
import { getUserWorkflows } from '@/modules/workflow/services/workflowPersistence';
import type { SavedWorkflow } from '@/modules/workflow/types';
import { IndiiFavicon } from '@/components/shared/IndiiFavicon';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { EntryOverlay } from './EntryOverlay';
import { getDashboardEntryCommands, type EntryCommandDefinition } from '@/services/commands/EntryCommandRegistry';

interface EmptyStateProps {
    /** Legacy: populate the prompt input box without submitting */
    onCommandClick: (cmd: string) => void;
    /** Immediately submit the command to the agent */
    onCommandSubmit: (cmd: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function EmptyState({ onCommandSubmit, onCommandClick }: EmptyStateProps) {
    const { setModule, isEntryAssistantDismissed, setEntryAssistantDismissed, user, setNodes, setEdges } = useStore(useShallow(state => ({
        setModule: state.setModule,
        isEntryAssistantDismissed: state.isEntryAssistantDismissed,
        setEntryAssistantDismissed: state.setEntryAssistantDismissed,
        user: state.user,
        setNodes: state.setNodes,
        setEdges: state.setEdges,
    })));

    const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);

    useEffect(() => {
        if (user?.uid) {
            getUserWorkflows(user.uid)
                .then(setSavedWorkflows)
                .catch(err => Logger.error('EmptyState', 'Failed to load workflows for EmptyState', err));
        }
    }, [user?.uid]);

    const commandIcons: Record<string, React.ElementType> = {
        'analyze-brand': Eye,
        'create-video': Play,
        'build-release': Command,
        'write-copy': PenTool,
        'design-cover': Image,
        'scout-venues': MapPin,
        'plan-campaign': Megaphone,
        'review-contract': FileCheck,
        'track-revenue': TrendingUp,
        'custom-workflow': Network,
    };

    const displayItems: Array<{
        icon: React.ElementType;
        title: string;
        prompt: string | null;
        summary?: string;
        action?: () => void;
        isWorkflow?: boolean;
    }> = [
        ...savedWorkflows.map(wf => ({
            icon: Zap,
            title: wf.name,
            prompt: null as string | null,
            action: () => {
                setNodes(wf.nodes);
                setEdges(wf.edges);
                setModule('workflow');
            },
            isWorkflow: true
        })),
        ...getDashboardEntryCommands().map((command: EntryCommandDefinition) => ({
            icon: commandIcons[command.id] || Command,
            title: command.title,
            prompt: command.slash,
            summary: command.summary,
            action: command.id === 'custom-workflow' ? () => onCommandSubmit(command.slash) : undefined,
        }))
    ].slice(0, 10); // keep to max 10 to fit the 5-column grid nicely

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-8 max-w-6xl mx-auto w-full">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-500/40 to-dept-creative/40 flex items-center justify-center shadow-2xl shadow-emerald-500/10 border border-white/10 mb-6 overflow-hidden"
            >
                <IndiiFavicon size={44} />
            </motion.div>

            <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-3xl font-semibold text-white tracking-wide text-center leading-none"
            >
                indii
            </motion.h2>

            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-emerald-200/60 font-medium uppercase tracking-[0.15em] text-[10px] mt-4 mb-10 text-center"
            >
                Your Creative Intelligence Engine • What Would You Like To Do?
            </motion.p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 w-full px-4">
                {displayItems.map((s, i) => (
                    <motion.button
                        key={s.title + i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.05 }}
                        onClick={() => {
                            if (s.action) {
                                s.action();
                            } else if (s.prompt) {
                                onCommandSubmit(s.prompt);
                            }
                        }}
                        className={`group relative flex flex-col p-5 rounded-2xl bg-white/[0.02] border hover:bg-white/[0.06] hover:shadow-lg transition-all duration-300 text-left overflow-hidden h-full ${
                            s.isWorkflow 
                            ? 'border-amber-500/20 hover:border-amber-500/40 hover:shadow-amber-500/5' 
                            : 'border-white/5 hover:border-emerald-500/40 hover:shadow-emerald-500/5'
                        }`}
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MousePointer2 size={12} className={s.isWorkflow ? "text-amber-400" : "text-emerald-400"} />
                        </div>
                        <s.icon size={22} className={`mb-3 group-hover:scale-110 transition-transform duration-300 ${s.isWorkflow ? 'text-amber-400' : 'text-emerald-400'}`} />
                        <h3 className="text-xs font-semibold text-white tracking-wide mb-1.5 line-clamp-1">{s.title}</h3>
                        <p className="text-[10px] text-slate-400 leading-relaxed font-normal group-hover:text-slate-300 transition-colors line-clamp-2">
                            {s.isWorkflow ? 'Custom User Workflow' : (s.summary || s.prompt)}
                        </p>
                    </motion.button>
                ))}
            </div>

            {/* NEW: Entry Overlay (Chat Overlay) */}
            {!isEntryAssistantDismissed ? (
                <EntryOverlay 
                    onSubmit={onCommandSubmit} 
                    onDismiss={() => setEntryAssistantDismissed(true)} 
                />
            ) : (
                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-12 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/50 text-xs font-medium hover:bg-white/10 hover:text-white transition-all border border-white/5"
                    onClick={() => setEntryAssistantDismissed(false)}
                >
                    <MessageSquare size={14} />
                    Restore Entry Assistant
                </motion.button>
            )}
        </div>

    );
}
