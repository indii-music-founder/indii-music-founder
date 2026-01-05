import React, { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    Node,
    Edge,
    MarkerType,
    useNodesState,
    useEdgesState,
    ConnectionMode
} from 'reactflow';
import 'reactflow/dist/style.css';
import { onSnapshot } from 'firebase/firestore';
import { TraceService } from '@/services/agent/observability/TraceService';
import { AgentTrace } from '@/services/agent/observability/types';
import { Badge } from '@/components/ui/badge';

interface SwarmGraphProps {
    swarmId: string;
    onNodeClick?: (trace: AgentTrace) => void;
}

const AGENT_COLORS: Record<string, string> = {
    'orchestrator': '#9333ea', // purple
    'generalist': '#2563eb', // blue
    'legal': '#dc2626', // red
    'finance': '#16a34a', // green
    'creative': '#db2777', // pink
    'publicist': '#ea580c', // orange
};

export function SwarmGraph({ swarmId, onNodeClick }: SwarmGraphProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [traces, setTraces] = useState<AgentTrace[]>([]);

    useEffect(() => {
        if (!swarmId) return;

        const q = TraceService.getSwarmQuery(swarmId);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AgentTrace[];
            setTraces(data);
        });

        return () => unsubscribe();
    }, [swarmId]);

    useEffect(() => {
        const newNodes: Node[] = traces.map((trace, index) => ({
            id: trace.id,
            data: {
                label: (
                    <div className="flex flex-col items-center gap-1">
                        <Badge style={{ backgroundColor: AGENT_COLORS[trace.agentId.toLowerCase()] || '#6b7280' }}>
                            {trace.agentId}
                        </Badge>
                        <span className="text-[10px] font-mono opacity-70 truncate max-w-[100px]">
                            {trace.id.slice(0, 8)}
                        </span>
                        {trace.status === 'pending' && (
                            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                        )}
                    </div>
                ),
                trace
            },
            position: { x: 0, y: index * 100 }, // Initial vertical layout
            style: {
                background: 'rgba(0,0,0,0.8)',
                color: '#fff',
                border: `1px solid ${AGENT_COLORS[trace.agentId.toLowerCase()] || '#333'}`,
                borderRadius: '8px',
                padding: '10px',
                width: 150
            },
        }));

        const newEdges: Edge[] = traces
            .filter(t => t.metadata?.parentTraceId)
            .map(t => ({
                id: `e-${t.metadata?.parentTraceId}-${t.id}`,
                source: t.metadata?.parentTraceId,
                target: t.id,
                animated: t.status === 'pending',
                style: { stroke: '#666' },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: '#666',
                },
            }));

        // Simple horizontal centering if no better layout is available
        // We can improve this with d3-hierarchy or dagre later
        setNodes(newNodes);
        setEdges(newEdges);
    }, [traces]);

    return (
        <div className="w-full h-full bg-black/20 rounded-xl border border-white/5 relative overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => onNodeClick?.(node.data.trace)}
                connectionMode={ConnectionMode.Loose}
                fitView
            >
                <Background color="#333" gap={16} />
                <Controls />
            </ReactFlow>
        </div>
    );
}
