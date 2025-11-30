import { StateCreator } from 'zustand';
import type { CustomNode, CustomEdge, KnowledgeDocument } from '@/modules/workflow/types';

export interface WorkflowSlice {
    nodes: CustomNode[];
    edges: CustomEdge[];
    selectedNodeId: string | null;
    knowledgeBase: KnowledgeDocument[];

    setNodes: (nodes: CustomNode[] | ((nodes: CustomNode[]) => CustomNode[])) => void;
    setEdges: (edges: CustomEdge[] | ((edges: CustomEdge[]) => CustomEdge[])) => void;
    addNode: (node: CustomNode) => void;
    setSelectedNodeId: (id: string | null) => void;
    addKnowledgeDocument: (doc: KnowledgeDocument) => void;
}

export const createWorkflowSlice: StateCreator<WorkflowSlice> = (set) => ({
    nodes: [],
    edges: [],
    selectedNodeId: null,
    knowledgeBase: [],

    setNodes: (nodes) => set((state) => ({
        nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes
    })),
    setEdges: (edges) => set((state) => ({
        edges: typeof edges === 'function' ? edges(state.edges) : edges
    })),
    addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    addKnowledgeDocument: (doc) => set((state) => ({ knowledgeBase: [...state.knowledgeBase, doc] })),
});
