export type TraceStatus = 'pending' | 'completed' | 'failed';

export interface UsageMetrics {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
    cachedContentTokens?: number;
    estimatedCost?: number;
}

export interface TraceStep {
    id: string; // Unique ID for the step
    timestamp: string; // ISO string
    type: 'thought' | 'tool_call' | 'tool_result' | 'routing' | 'final_response' | 'error';
    content: any; // Structured data
    metadata?: Record<string, any>;
    usage?: UsageMetrics;
}

export interface AgentTrace {
    id: string; // Firestore Doc ID
    userId: string;
    agentId: string;
    input: string;
    status: TraceStatus;
    startTime: any; // Firestore Timestamp
    endTime?: any; // Firestore Timestamp
    steps: TraceStep[];
    metadata?: Record<string, any>;
    swarmId?: string;
    error?: string;
    totalUsage?: UsageMetrics;
}
