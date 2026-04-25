import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { workflowRegistry } from '@/services/agent/orchestration/WorkflowRegistry';
import { GraphExecutionState, AgentGraph } from '@/services/agent/types';
import { logger } from '@/utils/logger';
import { useAuthStore } from '@/core/store/slices/auth';

const nodeTypes = {
    maestroNode: MaestroNode,
};

interface MaestroGraphProps {
    executionId?: string;
    graphId?: string;
}

const MaestroGraph: React.FC<MaestroGraphProps> = ({ executionId, graphId }) => {
    const { user } = useAuthStore();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [graphDefinition, setGraphDefinition] = useState<AgentGraph | null>(null);
    const [executionState, setExecutionState] = useState<GraphExecutionState | null>(null);

    // 1. Load Graph Definition
    useEffect(() => {
        if (graphId) {
            const graph = workflowRegistry.getGraph(graphId);
            if (graph) {
                setGraphDefinition(graph);
            }
        }
    }, [graphId]);

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
            const level = nodeLevels[n.id];
            const index = currentNodesInLevel[level] || 0;
            currentNodesInLevel[level] = index + 1;

            const x = level * 350 + 50;
            const y = index * 200 + 50;

            const nodeState = executionState?.nodeStates[n.id];

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
            animated: executionState?.nodeStates[e.sourceId]?.status === 'executing' || 
                      executionState?.nodeStates[e.targetId]?.status === 'executing',
            style: { 
                stroke: executionState?.nodeStates[e.sourceId]?.status === 'step_complete' ? '#14b8a6' : '#333',
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
                
                {executionState?.status === 'executing' && (
                    <div className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-lg animate-pulse">
                        <div className="w-2 h-2 bg-teal-500 rounded-full" />
                        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Neural Sequence Active</span>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="absolute bottom-6 right-6 z-10 bg-black/60 backdrop-blur-md border border-white/10 p-3 rounded-xl pointer-events-none">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-teal-500" />
                        <span className="text-[10px] text-gray-300 font-medium">Complete</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-400" />
                        <span className="text-[10px] text-gray-300 font-medium">Executing</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-600" />
                        <span className="text-[10px] text-gray-300 font-medium">Planned</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaestroGraph;
