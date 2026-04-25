import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
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

const statusConfig: Record<WorkflowExecutionStatus, { icon: any, color: string, bg: string, border: string, animate?: boolean }> = {
    planned: { icon: Hourglass, color: 'text-gray-400', bg: 'bg-gray-400/10', border: 'border-gray-400/20' },
    executing: { icon: LoaderCircle, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20', animate: true },
    completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
    failed: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' },
    awaiting_approval: { icon: Shield, color: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/20' },
    step_complete: { icon: CheckCircle, color: 'text-teal-400', bg: 'bg-teal-400/10', border: 'border-teal-400/20' },
    cancelled: { icon: AlertTriangle, color: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
    skipped: { icon: HelpCircle, color: 'text-gray-600', bg: 'bg-gray-600/10', border: 'border-gray-600/20' }
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
        <div className={`
            w-[260px] bg-black/80 backdrop-blur-xl rounded-2xl border transition-all duration-500
            ${selected ? 'border-teal-500 shadow-[0_0_30px_rgba(20,184,166,0.2)]' : 'border-white/10 shadow-2xl'}
        `}>
            {/* Header */}
            <div className={`px-4 py-3 border-b border-white/5 flex items-center justify-between rounded-t-2xl ${status.bg}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg bg-white/5 ${selected ? 'text-teal-400' : 'text-gray-400'}`}>
                        <AgentIcon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-white uppercase tracking-wider">{data.agentId}</p>
                        <p className="text-[9px] text-gray-500 font-medium">Node: {data.id}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <StatusIcon className={`w-3.5 h-3.5 ${status.color} ${status.animate ? 'animate-spin' : ''}`} />
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                <div className="space-y-1">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Directive</p>
                    <p className="text-[11px] text-gray-300 line-clamp-2 leading-relaxed italic">
                        "{data.taskTemplate}"
                    </p>
                </div>

                {data.status === 'completed' && data.output && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-500">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] text-teal-500 font-bold uppercase tracking-tight">Intelligence Output</p>
                            <span className="text-[8px] bg-teal-500/10 text-teal-400 px-1.5 py-0.5 rounded border border-teal-500/20">JSON</span>
                        </div>
                        <div className="bg-black/40 border border-white/5 rounded-lg p-2 max-h-[80px] overflow-hidden relative group">
                            <p className="text-[10px] font-mono text-gray-400 break-all line-clamp-4 leading-tight">
                                {data.output}
                            </p>
                            <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent group-hover:from-black/20 transition-all" />
                        </div>
                    </div>
                )}

                {data.status === 'failed' && (
                    <div className="space-y-1 border-t border-red-500/10 pt-2">
                        <p className="text-[10px] text-red-400 font-bold uppercase tracking-tight">Neural Failure</p>
                        <p className="text-[10px] text-red-300 leading-tight">
                            {data.error || 'Unknown execution error'}
                        </p>
                    </div>
                )}

                {data.status === 'executing' && (
                    <div className="pt-2">
                        <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                            <div className="bg-teal-500 h-full w-1/2 animate-[shimmer_2s_infinite_linear]" 
                                 style={{
                                     backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                                     backgroundSize: '200% 100%'
                                 }} 
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Handles */}
            <Handle
                type="target"
                position={Position.Left}
                className="w-2 h-2 !bg-teal-500 !border-2 !border-black transition-transform hover:scale-150"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="w-2 h-2 !bg-teal-500 !border-2 !border-black transition-transform hover:scale-150"
            />
        </div>
    );
};

export default memo(MaestroNode);
