import type { Node, Edge } from 'reactflow';
import type { Provenance } from '@shared/schemas/musicEntity';

export enum Status {
    PENDING = 'PENDING',
    WORKING = 'WORKING',
    WAITING_FOR_APPROVAL = 'WAITING_FOR_APPROVAL',
    DONE = 'DONE',
    ERROR = 'ERROR',
}

export type DataType =
    | 'TRIGGER'
    | 'TEXT'
    | 'IMAGE'
    | 'VIDEO'
    | 'AUDIO'
    | 'CONTEXT'
    | 'NOTE'
    | 'METADATA'
    | 'SPLITS'
    | 'RELEASE_PACKAGE'
    | 'AUDIO_QC'
    | 'SUBGRAPH'
    | 'ANY';

export type AssetData = Record<string, unknown>;

export interface AnyAsset {
    assetType: string;
    title?: string;
    [key: string]: unknown;
}

/**
 * First-class Music Industry Typed Assets for the Workflow Engine
 */
export interface NoteAsset extends AnyAsset {
    assetType: 'note';
    noteId?: string;
    title: string;
    content: string;
    tags?: string[];
    lyrics?: {
        verse?: string[];
        chorus?: string[];
        bridge?: string[];
        raw?: string;
    };
    sourceNoteId?: string;
}

export interface AudioQCAsset extends AnyAsset {
    assetType: 'audio_qc';
    pass: boolean;
    integratedLufs: number;
    targetLufs: number;
    truePeakDbfs: number;
    maxTruePeakDbfs: number;
    clippingDetected: boolean;
    sampleRateHz: number;
    bitDepth: number;
    issues: string[];
    recommendations: string[];
}

export interface MusicMetadataAsset extends AnyAsset {
    assetType: 'metadata';
    title: string;
    primaryArtist: string;
    featuredArtists: string[];
    genre: string;
    subGenre?: string;
    releaseDate: string;
    isrc?: string;
    upc?: string;
    explicit: boolean;
    language: string;
    pLine: string;
    cLine: string;
}

export interface SplitContributor {
    id: string;
    name: string;
    email: string;
    role: 'artist' | 'producer' | 'songwriter' | 'label' | 'engineer';
    masterPercentage: number;
    publishingPercentage: number;
    proAffiliation?: 'ASCAP' | 'BMI' | 'SESAC' | 'PRS' | 'SOCAN' | 'GEMA' | 'OTHER' | 'NONE';
    ipiNumber?: string;
}

export interface SplitSheetAsset extends AnyAsset {
    assetType: 'splits';
    trackTitle: string;
    contributors: SplitContributor[];
    totalMasterPercentage: number;
    totalPublishingPercentage: number;
    isBalanced: boolean;
    compiledAt: string;
}

export interface ReleasePackageAsset extends AnyAsset {
    assetType: 'release_package';
    trackTitle: string;
    primaryArtist: string;
    isrc: string;
    upc: string;
    masterAudioVerified: boolean;
    coverArtVerified: boolean;
    splitsVerified: boolean;
    qcPassed: boolean;
    readyForDelivery: boolean;
    checklist: Array<{ check: string; passed: boolean; details?: string }>;
    generatedAt: string;
}

// --- Node-Based Workflow Types ---
export type DepartmentNodeData = {
    nodeType: 'department';
    departmentName: string;
    status: Status;
    result?: AnyAsset | string;
    prompt?: string;
    selectedJobId?: string;
    config?: Record<string, unknown>;
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
    status?: Status;
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

/**
 * Subgraph / Micro-Workflow Node Data
 * Encapsulates a nested mini-workflow inside a single node on the master canvas.
 */
export type SubgraphNodeData = {
    nodeType: 'subgraph';
    label: string;
    subgraphId?: string;
    description?: string;
    subgraph: {
        nodes: CustomNode[];
        edges: CustomEdge[];
    };
    status: Status;
    result?: unknown;
    prompt?: string;
    config?: Record<string, unknown>;
};

export type NodeData =
    | DepartmentNodeData
    | InputNodeData
    | OutputNodeData
    | AudioSegmentNodeData
    | LogicNodeData
    | SubgraphNodeData;

export type CustomNode = Node<NodeData>;
export type CustomEdge = Edge;

export interface WorkflowLifecycleCallbacks {
    onNodeStart?: (nodeId: string, nodeName: string) => void;
    onNodeProgress?: (nodeId: string, progress: number, message?: string) => void;
    onNodeComplete?: (nodeId: string, result: unknown, cached?: boolean) => void;
    onNodeError?: (nodeId: string, error: string) => void;
    onWorkflowComplete?: (results: Map<string, unknown>) => void;
}

export interface WorkflowRunOptions {
    /** If true, ignores the content-addressable cache and recomputes all nodes */
    bypassCache?: boolean;
    /** If provided, only computes the dependencies required for these target node IDs */
    targetNodeIds?: string[];
    /** Granular lifecycle streaming callbacks (ComfyUI-style events) */
    callbacks?: WorkflowLifecycleCallbacks;
}

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

/**
 * Creative Auditions: 3 alternative directions proposed by the AI Co-Pilot
 */
export interface WorkflowAuditionVariant {
    id: string;
    title: string;
    description: string;
    prompt: string;
    styleRationale: string;
    config?: Record<string, unknown>;
    previewSummary?: string;
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

export interface AudioAnalysisJob {
    id: string;
    [key: string]: unknown;
}

export interface ConversationFile {
    id: string;
    file: File;
    preview: string;
    type: 'image' | 'document' | 'audio';
    base64?: string;
    content?: string;
    contentProvenance?: Provenance;
}
