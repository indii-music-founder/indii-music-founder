import React from 'react';
import { AgentTrace, TraceStep } from '@/services/agent/observability/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Brain, Wrench, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';

interface XRayPanelProps {
    trace: AgentTrace | null;
}

export function XRayPanel({ trace }: XRayPanelProps) {
    if (!trace) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground italic">
                Select an agent in the graph to inspect thoughts
            </div>
        );
    }

    const getStepIcon = (type: TraceStep['type']) => {
        switch (type) {
            case 'thought': return <Brain size={14} className="text-purple-400" />;
            case 'tool_call': return <Wrench size={14} className="text-blue-400" />;
            case 'tool_result': return <CheckCircle size={14} className="text-green-400" />;
            case 'routing': return <MessageSquare size={14} className="text-orange-400" />;
            case 'error': return <AlertCircle size={14} className="text-red-400" />;
            default: return null;
        }
    };

    return (
        <div className="h-full flex flex-col bg-black/40 border-l border-white/10">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <div>
                    <h3 className="font-bold flex items-center gap-2">
                        <Brain size={18} className="text-purple-500" />
                        X-Ray: {trace.agentId}
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-mono">{trace.id}</p>
                </div>
                <Badge variant={trace.status === 'completed' ? 'default' : 'secondary'}>
                    {trace.status}
                </Badge>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    {trace.steps.length === 0 && (
                        <p className="text-sm text-muted-foreground italic">No steps recorded yet...</p>
                    )}

                    {trace.steps.map((step, idx) => (
                        <div key={step.id || idx} className="space-y-2 group">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                                {getStepIcon(step.type)}
                                {step.type.replace('_', ' ')}
                                <span className="ml-auto font-normal opacity-50">
                                    {new Date(step.timestamp).toLocaleTimeString()}
                                </span>
                            </div>

                            <div className={`text-sm p-3 rounded-lg border ${step.type === 'thought' ? 'bg-purple-900/10 border-purple-500/20 text-purple-100/90 italic quote' :
                                step.type === 'tool_call' ? 'bg-blue-900/10 border-blue-500/20 font-mono text-blue-100/90' :
                                    step.type === 'error' ? 'bg-red-900/10 border-red-500/20 text-red-100/90' :
                                        'bg-white/5 border-white/10 text-gray-300'
                                }`}>
                                {typeof step.content === 'string'
                                    ? step.content
                                    : JSON.stringify(step.content, null, 2)}
                            </div>

                            {idx < trace.steps.length - 1 && <div className="h-px bg-white/5 opacity-50 my-4" />}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
