import React, { useCallback, useRef } from 'react';

import { Maximize, Eraser } from 'lucide-react';
import ReactFlow, {
    ReactFlowProvider,
    addEdge,
    Controls,
    Background,
    BackgroundVariant,
    MiniMap,
    Panel,
    applyNodeChanges,
    applyEdgeChanges,
    Connection,
    Edge,
    Node,
    NodeChange,
    EdgeChange,
    ReactFlowInstance,
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
    /** Called with the ReactFlowInstance once the canvas is ready.
     *  Use instance.getViewport() to capture the live viewport at save time. */
    onInit?: (instance: ReactFlowInstance) => void;
}

const WorkflowEditorContent: React.FC<WorkflowEditorProps> = ({ readOnly = false, onInit }) => {
    const { nodes, edges, setNodes, setEdges, addNode } = useStore();


    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = React.useState<ReactFlowInstance | null>(null);

    const onNodesChange = useCallback((changes: NodeChange[]) => {
        if (readOnly) return;
        setNodes(applyNodeChanges(changes, nodes));
    }, [nodes, setNodes, readOnly]);

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
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
                onInit={(instance) => {
                    setReactFlowInstance(instance);
                    onInit?.(instance);
                }}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                isValidConnection={isValidConnection}
                fitView
                className="bg-[#0f0f0f]"
                nodesDraggable={!readOnly}
                nodesConnectable={!readOnly}
                elementsSelectable={!readOnly}
                panOnDrag={true}
                zoomOnScroll={true}
                zoomOnPinch={true}
                minZoom={0.2}
                maxZoom={2}
            >
                <Controls
                    className="!bg-gray-800/80 !border-gray-700 !text-gray-400 [&>button]:!border-b-gray-700 hover:[&>button]:!bg-gray-700/50"
                    showInteractive={!readOnly}
                />

                <MiniMap
                    nodeStrokeColor="#374151"
                    nodeColor="#1f2937"
                    maskColor="rgba(17, 24, 39, 0.8)"
                    className="!bg-gray-900/50 !border !border-gray-800 !rounded-lg !overflow-hidden !bottom-4 !right-4"
                />

                <Panel position="top-right" className="flex gap-2">
                    <button
                        className="p-2 bg-gray-800/80 backdrop-blur border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors shadow-lg"
                        onClick={() => reactFlowInstance?.fitView()}
                        title="Fit View"
                    >
                        <Maximize size={18} />
                    </button>
                    {!readOnly && (
                        <button
                            className="p-2 bg-red-900/20 backdrop-blur border border-red-900/50 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-900/40 transition-colors shadow-lg"
                            onClick={() => setNodes([])}
                            title="Clear All"
                        >
                            <Eraser size={18} />
                        </button>
                    )}
                </Panel>

                <Background
                    gap={20}
                    size={2}
                    color="#374151"
                    variant={BackgroundVariant.Cross}
                    className="opacity-50"
                />
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
