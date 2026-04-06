import type { Timestamp } from 'firebase/firestore';

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
    content: unknown; // Structured data — narrow before use
    metadata?: Record<string, unknown>;
    usage?: UsageMetrics;
}

export interface AgentTrace {
    id: string; // Firestore Doc ID
    userId: string;
    agentId: string;
    input: string;
    status: TraceStatus;
    startTime: Timestamp; // Firestore Timestamp (always Timestamp on read)
    endTime?: Timestamp; // Firestore Timestamp (always Timestamp on read)
    steps: TraceStep[];
    metadata?: Record<string, unknown>;
    swarmId?: string;
    error?: string;
    durationMs?: number;
    totalUsage?: UsageMetrics;
}

