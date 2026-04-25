import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { WORKFLOW_REGISTRY, type WorkflowDefinition } from '@/services/agent/WorkflowRegistry';
import { agentGraphService } from '@/services/agent/orchestration/AgentGraphService';
import MaestroGraph from './components/MaestroGraph';
import { Play, Activity, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentGraph } from '@/services/agent/types';

/**
 * Maps a simple WorkflowDefinition to a more complex AgentGraph for the execution engine.
 */
const workflowToGraph = (workflow: WorkflowDefinition): AgentGraph => {
    // Determine entry node: find nodes with no incoming edges
    const incoming = new Set(workflow.edges.map(e => e.to));
    const entryNode = workflow.steps.find(s => !incoming.has(s.id)) || workflow.steps[0];

    return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        nodes: workflow.steps.map(step => ({
            id: step.id,
            agentId: step.agentId as any,
            taskTemplate: step.prompt,
            waitCondition: 'all'
        })),
        edges: workflow.edges.map(edge => ({
            sourceId: edge.from,
            targetId: edge.to,
        })),
        entryNodeId: entryNode?.id || workflow.steps[0]?.id || '',
        metadata: {
            version: '1.0.0',
            author: 'indiiOS',
            createdAt: Date.now()
        }
    };
};

export default function MaestroModule() {
    const { user } = useStore();
    const [selectedId, setSelectedId] = useState<string>('INDII_GROWTH_PROTOCOL');
    const [executionId, setExecutionId] = useState<string | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);

    const selectedWorkflow = WORKFLOW_REGISTRY[selectedId];

    const handleRunWorkflow = async () => {
        if (!user || !selectedWorkflow || isExecuting) return;

        setIsExecuting(true);
        try {
            const graph = workflowToGraph(selectedWorkflow);
            const id = await agentGraphService.executeGraph(graph, {
                userId: user.uid,
                traceId: crypto.randomUUID(),
                sessionId: 'maestro-session'
            });
            setExecutionId(id);
        } catch (error) {
            console.error('Failed to execute graph:', error);
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div className="flex h-full w-full bg-black/40 backdrop-blur-xl overflow-hidden">
            {/* Left Sidebar: Workflow Selection */}
            <div className="w-80 border-r border-white/10 flex flex-col p-6 gap-6 overflow-y-auto bg-black/20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-500/20 rounded-lg">
                        <Activity className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Maestro</h2>
                        <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Orchestration</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <p className="text-xs font-bold text-white/30 uppercase tracking-wider">Available Protocols</p>
                    {Object.values(WORKFLOW_REGISTRY).map(workflow => (
                        <button
                            key={workflow.id}
                            onClick={() => {
                                setSelectedId(workflow.id);
                                setExecutionId(null);
                            }}
                            className={`w-full text-left p-4 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                                selectedId === workflow.id 
                                ? 'bg-white/10 border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)]' 
                                : 'hover:bg-white/5 border border-transparent'
                            }`}
                        >
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className={`font-bold transition-colors ${selectedId === workflow.id ? 'text-teal-400' : 'text-white/70 group-hover:text-white'}`}>
                                        {workflow.name}
                                    </h3>
                                    {selectedId === workflow.id && (
                                        <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                                    )}
                                </div>
                                <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">{workflow.description}</p>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="mt-auto space-y-4">
                    <button
                        onClick={handleRunWorkflow}
                        disabled={isExecuting}
                        className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-500 ${
                            isExecuting 
                            ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' 
                            : 'bg-teal-500 hover:bg-teal-400 text-black shadow-[0_0_30px_rgba(20,184,166,0.3)] hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                    >
                        {isExecuting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
                                <span>Running...</span>
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4 fill-current" />
                                <span>Execute Protocol</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Main Area: Graph Visualization */}
            <div className="flex-1 relative flex flex-col min-w-0">
                <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-black/10 backdrop-blur-md relative z-20">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-white/60">Execution:</span>
                        <span className="text-sm font-mono text-teal-400 bg-teal-400/10 px-3 py-1 rounded-full border border-teal-400/20 flex items-center gap-2">
                            {executionId ? (
                                <>
                                    <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
                                    {executionId.slice(0, 8)}
                                </>
                            ) : (
                                <span className="animate-pulse text-white/30">IDLE_WAITING</span>
                            )}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                            <span className="text-xs text-white/60 font-medium">Real-time Sync</span>
                        </div>
                        <div className="h-4 w-px bg-white/10" />
                        <button className="text-white/40 hover:text-white transition-colors">
                            <Layers className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                <div className="flex-1 relative">
                    <AnimatePresence mode="wait">
                        {selectedWorkflow && (
                            <motion.div
                                key={selectedId + (executionId || 'initial')}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.02 }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute inset-0"
                            >
                                <MaestroGraph 
                                    graph={workflowToGraph(selectedWorkflow)}
                                    executionId={executionId || undefined}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Legend Overlay */}
                <div className="absolute bottom-8 left-8 p-4 bg-black/40 backdrop-blur-3xl border border-white/10 rounded-2xl flex gap-8 items-center z-10 pointer-events-none shadow-2xl">
                    <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-white/10 border border-white/20" />
                        <span className="text-[9px] text-white/40 uppercase tracking-[0.2em] font-black">Planned</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="relative">
                            <div className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping absolute inset-0 opacity-40" />
                            <div className="w-2.5 h-2.5 rounded-full bg-teal-500 relative" />
                        </div>
                        <span className="text-[9px] text-teal-400 uppercase tracking-[0.2em] font-black">Executing</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                        <span className="text-[9px] text-emerald-500 uppercase tracking-[0.2em] font-black">Success</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]" />
                        <span className="text-[9px] text-rose-500 uppercase tracking-[0.2em] font-black">Failed</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
