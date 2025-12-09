import type { Node, Edge } from 'reactflow';

export enum Status {
    PENDING = 'PENDING',
    WORKING = 'WORKING',
    WAITING_FOR_APPROVAL = 'WAITING_FOR_APPROVAL',
    DONE = 'DONE',
    ERROR = 'ERROR',
}

export interface AnyAsset {
    assetType: string;
    title?: string;
    [key: string]: any;
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
    status?: Status; // Added status
    result?: any; // Added result
};

export type AudioSegmentNodeData = {
    nodeType: 'audioSegment';
    segmentLabel: string;
    startTime: number;
    endTime: number;
    status?: Status; // Added status
    result?: any; // Added result
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
        condition?: string; // For Router: e.g., "bpm > 120"
        message?: string; // For Gatekeeper: "Approve this art?"
        variableKey?: string; // For Variable nodes
        [key: string]: any;
    };
    result?: any;
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

export type WorkflowData = Omit<SavedWorkflow, 'id' | 'createdAt' | 'updatedAt'>;

export type KnowledgeDocumentIndexingStatus = 'pending' | 'indexing' | 'ready' | 'error';

export interface KnowledgeDocument {
    id: string;
    name: string;
    content: string;
    type: string;
    tags?: string[];
    entities?: string[];
    embeddingId?: string;
    indexingStatus: KnowledgeDocumentIndexingStatus;
    createdAt: number;
}

export interface KnowledgeAsset extends AnyAsset {
    assetType: 'knowledge';
    content: string;
    sources: { name: string; content: string }[];
    retrievalDetails?: any[];
    reasoningTrace?: string[];
}

export interface SocialLinks {
    twitter?: string;
    instagram?: string;
    website?: string;
    spotify?: string;
    soundcloud?: string;
    bandcamp?: string;
    beatport?: string;
    pro?: string; // Performing Rights Org
    distributor?: string;
}

export interface ReleaseDetails {
    title: string;
    type: string; // Single, EP, Album
    artists: string;
    genre: string;
    mood: string;
    themes: string;
    lyrics: string;
}

export interface BrandAsset {
    id?: string;
    url: string;
    description: string;
}

export interface BrandKit {
    colors: string[];
    fonts: string;
    brandDescription: string;
    negativePrompt: string;
    socials: SocialLinks;
    brandAssets: BrandAsset[];
    referenceImages: BrandAsset[];
    releaseDetails: ReleaseDetails;
}

export interface UserProfile {
    id?: string; // Added for reference image path construction
    bio: string;
    preferences: string;
    careerStage?: string;
    goals?: string[];
    brandKit: BrandKit;
    analyzedTrackIds: string[];
    knowledgeBase: KnowledgeDocument[];
    savedWorkflows: SavedWorkflow[];
}

export interface AudioAnalysisJob {
    id: string;
    [key: string]: any;
}

export interface ConversationFile {
    id: string;
    file: File;
    preview: string; // data URL for images
    type: 'image' | 'document';
    base64?: string; // base64 string for images
    content?: string; // text content for documents
}
