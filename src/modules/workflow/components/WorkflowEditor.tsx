import React, { useCallback, useRef } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    addEdge,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    Connection,
    Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '../../../core/store';
import { DepartmentNode, InputNode, OutputNode, AudioSegmentNode, LogicNode } from './CustomNodes';
import { Status } from '../types';

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
        // Mock validation for now
        return true;
    }, []);

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

        const nodeType = event.dataTransfer.getData('application/reactflow');

        if (nodeType === 'departmentNode') {
            const departmentName = event.dataTransfer.getData('application/departmentName');
            const newNode: any = {
                id: `${departmentName.replace(/\s+/g, '')}-${+new Date()}`,
                type: 'departmentNode',
                position,
                data: {
                    nodeType: 'department',
                    departmentName: departmentName,
                    status: Status.PENDING
                },
            };
            addNode(newNode);
            return;
        }

        if (nodeType === 'logicNode') {
            const departmentName = event.dataTransfer.getData('application/departmentName'); // 'Logic'
            const jobId = event.dataTransfer.getData('application/jobId');
            const newNode: any = {
                id: `logic-${jobId}-${+new Date()}`,
                type: 'logicNode',
                position,
                data: {
                    nodeType: 'logic',
                    departmentName: departmentName, // Used by UniversalNode to look up registry
                    selectedJobId: jobId,
                    label: jobId === 'router' ? 'Router' : 'Gatekeeper',
                    status: Status.PENDING,
                    config: {}
                },
            };
            addNode(newNode);
            return;
        }

        if (nodeType === 'inputNode') {
            const newNode: any = {
                id: `input-${+new Date()}`,
                type: 'inputNode',
                position,
                data: {
                    nodeType: 'input',
                    prompt: 'Enter your prompt here...',
                    status: Status.PENDING
                },
            };
            addNode(newNode);
            return;
        }

        if (nodeType === 'outputNode') {
            const newNode: any = {
                id: `output-${+new Date()}`,
                type: 'outputNode',
                position,
                data: {
                    nodeType: 'output',
                    status: Status.PENDING
                },
            };
            addNode(newNode);
            return;
        }

        const audioSegmentData = event.dataTransfer.getData('application/audiosegment');
        if (audioSegmentData) {
            const { label, start, end } = JSON.parse(audioSegmentData);
            const newNode: any = {
                id: `audio-segment-${+new Date()}`,
                type: 'audioSegmentNode',
                position,
                data: {
                    nodeType: 'audioSegment',
                    segmentLabel: label,
                    startTime: start,
                    endTime: end,
                },
            };
            addNode(newNode);
            return;
        }

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
