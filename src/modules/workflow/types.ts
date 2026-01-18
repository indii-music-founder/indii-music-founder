import type { Node, Edge } from 'reactflow';

export enum Status {
    PENDING = 'PENDING',
    WORKING = 'WORKING',
    WAITING_FOR_APPROVAL = 'WAITING_FOR_APPROVAL',
    DONE = 'DONE',
    ERROR = 'ERROR',
}

export type AssetData = Record<string, unknown>;

export interface AnyAsset {
    assetType: string;
    title?: string;
    [key: string]: unknown;
}

// --- Node-Based Workflow Types ---
export type DepartmentNodeData = {
    nodeType: 'department';
    departmentName: string;
    status: Status;
    result?: AnyAsset | string;
    prompt?: string; // The specific prompt for this node
    selectedJobId?: string; // The ID of the specific job type selected (e.g., 'video-img-to-video')
};

export type InputNodeData = {
    nodeType: 'input';
    prompt: string;
    status?: Status;
    result?: unknown;
};

export type AudioSegmentNodeData = {
    nodeType: 'audioSegment';
    segmentLabel: string;
    startTime: number;
    endTime: number;
    status?: Status;
    result?: unknown;
};

export type OutputNodeData = {
    nodeType: 'output';
    result?: AnyAsset | string;
    status?: Status; // Added status
};

export type LogicNodeData = {
    nodeType: 'logic';
    jobId: string; // 'router', 'gatekeeper', 'set_variable', 'get_variable'
    label: string;
    status: Status;
    config: {
        condition?: string;
        message?: string;
        variableKey?: string;
        [key: string]: unknown;
    };
    result?: unknown;
};

export type NodeData = DepartmentNodeData | InputNodeData | OutputNodeData | AudioSegmentNodeData | LogicNodeData;
export type CustomNode = Node<NodeData>;
export type CustomEdge = Edge;

export interface SavedWorkflow {
    id: string;
    name: string;
    description: string;
    nodes: CustomNode[];
    edges: CustomEdge[];
    viewport: { x: number; y: number; zoom: number };
    createdAt: string;
    updatedAt: string;
}

export type { BrandKit, BrandAsset, ReleaseDetails, SocialLinks, KnowledgeDocument, KnowledgeDocumentIndexingStatus, UserProfile } from '@/types/User';

export type WorkflowData = Omit<SavedWorkflow, 'id' | 'createdAt' | 'updatedAt'>;

export interface KnowledgeAsset extends AnyAsset {
    assetType: 'knowledge';
    content: string;
    sources: { name: string; content: string }[];
    retrievalDetails?: Record<string, unknown>[];
    reasoningTrace?: string[];
}

// UserProfile moved to @/types/User


export interface AudioAnalysisJob {
    id: string;
    [key: string]: unknown;
}

export interface ConversationFile {
    id: string;
    file: File;
    preview: string; // data URL for images
    type: 'image' | 'document' | 'audio';
    base64?: string; // base64 string for images
    content?: string; // text content for documents
}
