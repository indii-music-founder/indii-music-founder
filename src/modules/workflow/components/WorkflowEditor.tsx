import React, { useCallback, useRef } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    addEdge,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    Connection,
    Edge,
    Node
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '@/core/store';
import { validateConnection } from '../utils/validationUtils';
import { DepartmentNode, InputNode, OutputNode, AudioSegmentNode, LogicNode } from './CustomNodes';
import { createNodeFromDrop } from '../utils/dndUtils';
import { getJobDefinition } from '../services/nodeRegistry';

const nodeTypes = {
    departmentNode: DepartmentNode,
    inputNode: InputNode,
    outputNode: OutputNode,
    audioSegmentNode: AudioSegmentNode,
    logicNode: LogicNode,
};

interface WorkflowEditorProps {
    readOnly?: boolean;
}

const WorkflowEditorContent: React.FC<WorkflowEditorProps> = ({ readOnly = false }) => {
    const { nodes, edges, setNodes, setEdges, addNode } = useStore();

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = React.useState<any>(null);

    const onNodesChange = useCallback((changes: any) => {
        if (readOnly) return;
        setNodes(applyNodeChanges(changes, nodes));
    }, [nodes, setNodes, readOnly]);

    const onEdgesChange = useCallback((changes: any) => {
        if (readOnly) return;
        setEdges(applyEdgeChanges(changes, edges));
    }, [edges, setEdges, readOnly]);

    // --- STRICT CONNECTION VALIDATION ---
    const isValidConnection = useCallback((connection: Connection) => {
        const sourceNode = nodes.find((n) => n.id === connection.source);
        const targetNode = nodes.find((n) => n.id === connection.target);

        if (!sourceNode || !targetNode) return false;

        return validateConnection(sourceNode, targetNode, connection.sourceHandle, connection.targetHandle);
    }, [nodes]);

    const onConnect = useCallback((params: Connection | Edge) => {
        if (readOnly) return;
        if (isValidConnection(params as Connection)) {
            setEdges(addEdge(params, edges));
        }
    }, [edges, setEdges, isValidConnection, readOnly]);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        if (readOnly) return;
        if (!reactFlowWrapper.current || !reactFlowInstance) return;

        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
        const position = reactFlowInstance.project({
            x: event.clientX - reactFlowBounds.left,
            y: event.clientY - reactFlowBounds.top,
        });

        createNodeFromDrop(event, position, addNode);

    }, [reactFlowInstance, addNode, readOnly]);

    return (
        <div className="h-full w-full" ref={reactFlowWrapper}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                isValidConnection={isValidConnection}
                fitView
                className="bg-transparent"
                nodesDraggable={!readOnly}
                nodesConnectable={!readOnly}
                elementsSelectable={!readOnly}
                panOnDrag={true}
                zoomOnScroll={true}
                zoomOnPinch={true}
            >
                <Controls className="react-flow-controls" showInteractive={!readOnly} />
                <Background gap={16} color="#334155" />
            </ReactFlow>
        </div>
    );
};

const WorkflowEditor: React.FC<WorkflowEditorProps> = (props) => (
    <ReactFlowProvider>
        <WorkflowEditorContent {...props} />
    </ReactFlowProvider>
);

export default WorkflowEditor;
