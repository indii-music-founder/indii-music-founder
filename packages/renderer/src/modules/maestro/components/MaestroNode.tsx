import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle, 
    Hourglass, 
    LoaderCircle, 
    AlertTriangle, 
    User,
    Shield,
    Briefcase,
    Music,
    Video,
    Share2,
    Megaphone,
    BookOpen,
    Lock,
    Globe,
    Cpu,
    Palette,
    BarChart3,
    Terminal,
    Search,
    Brain,
    HelpCircle
} from 'lucide-react';
import { ValidAgentId, WorkflowExecutionStatus } from '@/services/agent/types';

interface MaestroNodeData {
    id: string;
    agentId: ValidAgentId;
    label: string;
    taskTemplate: string;
    status: WorkflowExecutionStatus;
    output?: string;
    error?: string;
}

const statusConfig: Record<WorkflowExecutionStatus, { 
    icon: any, 
    color: string, 
    bg: string, 
    border: string, 
    glow: string,
    label: string,
    animate?: boolean 
}> = {
    planned: { 
        icon: Hourglass, 
        color: 'text-gray-400', 
        bg: 'bg-gray-400/5', 
        border: 'border-gray-400/10',
        glow: 'shadow-none',
        label: 'Planned'
    },
    executing: { 
        icon: LoaderCircle, 
        color: 'text-teal-400', 
        bg: 'bg-teal-500/10', 
        border: 'border-teal-500/30',
        glow: 'shadow-[0_0_20px_rgba(20,184,166,0.3)]',
        label: 'Executing',
        animate: true 
    },
    completed: { 
        icon: CheckCircle, 
        color: 'text-emerald-400', 
        bg: 'bg-emerald-500/10', 
        border: 'border-emerald-500/30',
        glow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]',
        label: 'Complete'
    },
    failed: { 
        icon: AlertTriangle, 
        color: 'text-rose-400', 
        bg: 'bg-rose-500/10', 
        border: 'border-rose-500/30',
        glow: 'shadow-[0_0_15px_rgba(244,63,94,0.2)]',
        label: 'Failed'
    },
    awaiting_approval: { 
        icon: Shield, 
        color: 'text-amber-400', 
        bg: 'bg-amber-500/10', 
        border: 'border-amber-500/30',
        glow: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]',
        label: 'Awaiting Approval'
    },
    step_complete: { 
        icon: CheckCircle, 
        color: 'text-teal-400', 
        bg: 'bg-teal-500/10', 
        border: 'border-teal-500/30',
        glow: 'shadow-[0_0_15px_rgba(20,184,166,0.2)]',
        label: 'Step Success'
    },
    cancelled: { 
        icon: AlertTriangle, 
        color: 'text-gray-500', 
        bg: 'bg-gray-500/5', 
        border: 'border-gray-500/20',
        glow: 'shadow-none',
        label: 'Cancelled'
    },
    skipped: { 
        icon: HelpCircle, 
        color: 'text-gray-600', 
        bg: 'bg-gray-600/5', 
        border: 'border-gray-600/20',
        glow: 'shadow-none',
        label: 'Skipped'
    }
};

const agentIconMap: Record<ValidAgentId, any> = {
    marketing: Megaphone,
    legal: ScaleIcon, // Will use Scale from lucide or fallback
    finance: BarChart3,
    producer: Brain,
    director: Video,
    screenwriter: BookOpen,
    video: Video,
    social: Share2,
    publicist: Globe,
    road: Globe,
    creative: Palette,
    publishing: BookOpen,
    licensing: Lock,
    brand: Shield,
    devops: Terminal,
    security: Lock,
    merchandise: Briefcase,
    distribution: Globe,
    music: Music,
    curriculum: BookOpen,
    keeper: Shield,
    generalist: Cpu
};

// Simple Scale icon if not imported
function ScaleIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path d="M7 21h10" />
            <path d="M12 3v18" />
            <path d="M3 7h18" />
        </svg>
    );
}

const MaestroNode = ({ data, selected }: NodeProps<MaestroNodeData>) => {
    const status = statusConfig[data.status] || statusConfig.planned;
    const StatusIcon = status.icon;
    const AgentIcon = agentIconMap[data.agentId] || User;

    return (
        <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ 
                scale: 1, 
                opacity: 1,
                borderColor: selected ? 'rgba(20, 184, 166, 0.5)' : 'rgba(255, 255, 255, 0.1)',
            }}
            className={`
                relative w-[280px] bg-black/40 backdrop-blur-3xl rounded-2xl border overflow-hidden
                ${selected ? 'shadow-[0_0_40px_rgba(20,184,166,0.15)]' : 'shadow-2xl'}
                ${status.glow} transition-shadow duration-700
            `}
        >
            {/* Executing Pulse Effect */}
            {data.status === 'executing' && (
                <motion.div 
                    animate={{ 
                        opacity: [0.1, 0.3, 0.1],
                        scale: [1, 1.02, 1]
                    }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 bg-teal-500/5 pointer-events-none"
                />
            )}

            {/* Header */}
            <div className={`px-4 py-3 border-b border-white/5 flex items-center justify-between transition-colors duration-500 ${status.bg}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-xl bg-black/40 border border-white/10 shadow-inner ${selected ? 'text-teal-400' : 'text-gray-400'}`}>
                        <AgentIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-xs font-black text-white uppercase tracking-widest">{data.agentId}</p>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold border ${status.border} ${status.color} bg-black/20`}>
                                {status.label}
                            </span>
                        </div>
                        <p className="text-[9px] text-gray-500 font-mono">ID: {data.id.split('-')[0]}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={data.status}
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                        >
                            <StatusIcon className={`w-4 h-4 ${status.color} ${status.animate ? 'animate-spin' : ''}`} />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em]">Neural Directive</p>
                    <div className="relative">
                        <div className="absolute -left-2 top-0 bottom-0 w-0.5 bg-linear-to-b from-teal-500/50 to-transparent rounded-full" />
                        <p className="text-[11px] text-gray-300 line-clamp-3 leading-relaxed pl-2">
                            {data.taskTemplate}
                        </p>
                    </div>
                </div>

                <AnimatePresence>
                    {(data.status === 'completed' || data.status === 'step_complete') && data.output && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="space-y-2 border-t border-white/5 pt-3 overflow-hidden"
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-[9px] text-teal-400 font-black uppercase tracking-[0.2em]">Sequence Output</p>
                                <span className="text-[8px] bg-teal-500/10 text-teal-300 px-1.5 py-0.5 rounded-sm border border-teal-500/20 font-mono">200 OK</span>
                            </div>
                            <div className="bg-black/60 border border-white/5 rounded-xl p-3 max-h-[100px] overflow-hidden relative group cursor-pointer hover:border-teal-500/30 transition-colors">
                                <p className="text-[10px] font-mono text-gray-400 break-all line-clamp-5 leading-tight selection:bg-teal-500/30">
                                    {data.output}
                                </p>
                                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent group-hover:via-transparent transition-all" />
                            </div>
                        </motion.div>
                    )}

                    {data.status === 'failed' && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="space-y-2 border-t border-rose-500/20 pt-3"
                        >
                            <p className="text-[9px] text-rose-400 font-black uppercase tracking-[0.2em]">Protocol Fault</p>
                            <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">
                                <p className="text-[10px] text-rose-300 leading-tight font-medium">
                                    {data.error || 'The agent encountered an unhandled neural exception.'}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {data.status === 'executing' && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="pt-2"
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[8px] text-teal-400/60 font-bold uppercase tracking-widest">Processing</span>
                                <span className="text-[8px] text-teal-400/60 font-mono animate-pulse">SYNC_ACTIVE</span>
                            </div>
                            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                <motion.div 
                                    animate={{ 
                                        x: ['-100%', '100%']
                                    }}
                                    transition={{ 
                                        repeat: Infinity, 
                                        duration: 1.5,
                                        ease: "linear"
                                    }}
                                    className="bg-linear-to-r from-transparent via-teal-400 to-transparent h-full w-1/2" 
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Handles */}
            <Handle
                type="target"
                position={Position.Left}
                className="w-3 h-3 !bg-black !border-2 !border-white/20 transition-all hover:!border-teal-400 hover:scale-125 !-left-1.5"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="w-3 h-3 !bg-black !border-2 !border-white/20 transition-all hover:!border-teal-400 hover:scale-125 !-right-1.5"
            />
        </motion.div>
    );
};

export default memo(MaestroNode);
