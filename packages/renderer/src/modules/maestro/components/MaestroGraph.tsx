import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import ReactFlow, { 
    Background, 
    Controls, 
    ConnectionLineType,
    Node,
    Edge,
    useNodesState,
    useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import MaestroNode from './MaestroNode';
import { agentGraphStateService } from '@/services/agent/orchestration/AgentGraphStateService';
import { WORKFLOW_REGISTRY } from '@/services/agent/WorkflowRegistry';
import { GraphExecutionState, AgentGraph } from '@/services/agent/types';
import { logger } from '@/utils/logger';
import { useStore } from '@/core/store';

const nodeTypes = {
    maestroNode: MaestroNode,
};

interface MaestroGraphProps {
    executionId?: string;
    graph?: AgentGraph;
}

const MaestroGraph: React.FC<MaestroGraphProps> = ({ executionId, graph }) => {
    const { user } = useStore();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [executionState, setExecutionState] = useState<GraphExecutionState | null>(null);

    // 1. Graph Definition is passed as prop
    const graphDefinition = graph;

    // 2. Subscribe to Execution State
    useEffect(() => {
        if (user?.uid && executionId) {
            logger.info(`[MaestroGraph] Subscribing to execution: ${executionId}`);
            const unsubscribe = agentGraphStateService.subscribeToExecution(user.uid, executionId, (state) => {
                setExecutionState(state);
            });
            return () => unsubscribe();
        }
    }, [user?.uid, executionId]);

    // 3. Map Graph + Execution to ReactFlow Nodes & Edges
    useEffect(() => {
        if (!graphDefinition) return;

        // Auto-layout logic (Simple Level-based)
        const levels: Record<string, number> = {};
        const getLevel = (nodeId: string, visited = new Set<string>()): number => {
            if (visited.has(nodeId)) return 0;
            visited.add(nodeId);
            
            const incoming = graphDefinition.edges.filter(e => e.targetId === nodeId);
            if (incoming.length === 0) return 0;
            
            return Math.max(...incoming.map(e => getLevel(e.sourceId, visited))) + 1;
        };

        const nodeLevels: Record<string, number> = {};
        const nodesPerLevel: Record<number, number> = {};
        
        graphDefinition.nodes.forEach(n => {
            const level = getLevel(n.id);
            nodeLevels[n.id] = level;
            nodesPerLevel[level] = (nodesPerLevel[level] || 0) + 1;
        });

        const currentNodesInLevel: Record<number, number> = {};

        const rfNodes: Node[] = graphDefinition.nodes.map((n) => {
            const level = nodeLevels[n.id] || 0;
            const index = currentNodesInLevel[level] || 0;
            currentNodesInLevel[level] = index + 1;

            const x = level * 350 + 50;
            const y = index * 200 + 50;

            const nodeState = executionState?.nodeStates?.[n.id];

            return {
                id: n.id,
                type: 'maestroNode',
                position: { x, y },
                data: {
                    id: n.id,
                    agentId: n.agentId,
                    label: n.id,
                    taskTemplate: n.taskTemplate,
                    status: nodeState?.status || 'planned',
                    output: nodeState?.output,
                    error: nodeState?.error,
                },
            };
        });

        const rfEdges: Edge[] = graphDefinition.edges.map((e, idx) => ({
            id: `edge-${idx}`,
            source: e.sourceId,
            target: e.targetId,
            animated: executionState?.nodeStates?.[e.sourceId]?.status === 'executing' || 
                      executionState?.nodeStates?.[e.targetId]?.status === 'executing',
            style: { 
                stroke: executionState?.nodeStates?.[e.sourceId]?.status === 'step_complete' ? '#14b8a6' : '#333',
                strokeWidth: 2 
            },
            type: ConnectionLineType.SmoothStep,
        }));

        setNodes(rfNodes);
        setEdges(rfEdges);
    }, [graphDefinition, executionState, setNodes, setEdges]);

    return (
        <div className="w-full h-full bg-[#050505] relative overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                className="bg-dot-white/[0.05]"
            >
                <Background color="#14b8a6" gap={20} size={1} />
                <Controls className="bg-black/80 border-white/10 fill-white" />
            </ReactFlow>

            {/* Status Overlay */}
            <div className="absolute top-6 left-6 z-10 space-y-2 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl">
                    <h2 className="text-sm font-bold text-white tracking-tight">
                        {graphDefinition?.name || 'Loading Graph...'}
                    </h2>
                    <p className="text-[10px] text-gray-400 font-medium">
                        {executionId ? `Execution: ${executionId.slice(0, 8)}...` : 'Blueprint View'}
                    </p>
                </div>
            </div>
                
            {/* Active Status Overlay */}
            {executionState?.status === 'executing' && (
                <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-24 left-6 z-10 flex items-center gap-3 bg-teal-500/10 backdrop-blur-xl border border-teal-500/30 px-4 py-2 rounded-2xl shadow-[0_0_30px_rgba(20,184,166,0.1)]"
                >
                    <div className="relative">
                        <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-ping absolute inset-0" />
                        <div className="w-2.5 h-2.5 bg-teal-500 rounded-full relative" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-teal-400 uppercase tracking-[0.2em]">Neural Sequence Active</span>
                        <span className="text-[8px] text-teal-400/60 font-mono">BROADCASTING_TO_SPECIALISTS...</span>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default MaestroGraph;
