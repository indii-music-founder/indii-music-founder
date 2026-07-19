import React from 'react';
import { Network, Play, ChevronRight, Database, Activity, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { WorkflowEngine } from '@/modules/workflow/services/WorkflowEngine';

interface WorkflowPanelProps {
    toggleRightPanel: () => void;
}

export default function WorkflowPanel({ toggleRightPanel }: WorkflowPanelProps) {
    const toast = useToast();
    const [isRunning, setIsRunning] = React.useState(false);

    const { nodes, edges, setNodes } = useStore(
        useShallow((state) => ({
            nodes: state.nodes,
            edges: state.edges,
            setNodes: state.setNodes,
        }))
    );

    const handleRunWorkflow = async () => {
        if (isRunning) return;
        setIsRunning(true);
        toast.info("Workflow execution started");
        
        try {
            const engine = new WorkflowEngine(nodes, edges, setNodes);
            await engine.run();
            toast.success("Workflow execution completed");
        } catch (error) {
            console.error('Workflow execution error:', error);
            toast.error(error instanceof Error ? error.message : "Workflow failed to run");
        } finally {
            setIsRunning(false);
        }
    };

    const hasDatabaseAccess = nodes.some(n => n.type === 'logicNode' && (n.data as any).operation === 'extract');

    return (
        <div className="flex flex-col h-full bg-linear-to-b from-bg-dark to-bg-dark/90">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <div className="p-1.5 bg-orange-500/10 rounded-lg">
                        <Network size={14} className="text-orange-400" />
                    </div>
                    Workflow Builder
                </h3>
                <div className="flex items-center gap-2">
                    <button onClick={toggleRightPanel} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-gray-500 tracking-wider">EXECUTION</label>
                    <motion.button
                        whileHover={{ scale: isRunning ? 1 : 1.02 }}
                        whileTap={{ scale: isRunning ? 1 : 0.98 }}
                        onClick={handleRunWorkflow}
                        disabled={isRunning || nodes.length === 0}
                        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2 border ${
                            isRunning 
                            ? 'bg-orange-900/50 text-orange-200 border-orange-500/30 cursor-not-allowed shadow-none'
                            : nodes.length === 0
                            ? 'bg-gray-800/50 text-gray-500 border-gray-700/30 cursor-not-allowed shadow-none'
                            : 'bg-linear-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-orange-900/20 border-orange-400/20'
                        }`}
                    >
                        {isRunning ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Running...
                            </>
                        ) : (
                            <>
                                <Play size={16} />
                                Run Workflow
                            </>
                        )}
                    </motion.button>
                </div>

                <div className="space-y-2 pt-4 border-t border-white/10">
                    <label className="text-[10px] font-bold text-gray-500 tracking-wider">ACTIVE ENVIRONMENT</label>
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 flex items-center gap-2"><Database size={14} /> Database</span>
                            <span className={`text-xs font-mono ${hasDatabaseAccess ? 'text-green-400' : 'text-gray-500'}`}>
                                {hasDatabaseAccess ? 'Connected' : 'Unused'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 flex items-center gap-2"><Activity size={14} /> Execution Queue</span>
                            <span className={`text-xs font-mono ${isRunning ? 'text-orange-400' : 'text-gray-300'}`}>
                                {isRunning ? 'Running' : 'Idle'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
