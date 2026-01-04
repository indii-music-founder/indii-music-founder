export type TraceStatus = 'pending' | 'completed' | 'failed';

export interface TraceStep {
    id: string; // Unique ID for the step (e.g., uuid or timestamp)
    timestamp: string; // ISO string
    type: 'thought' | 'tool_call' | 'tool_result' | 'routing' | 'final_response' | 'error';
    content: any; // Structured data depending on type
    metadata?: Record<string, any>;
}

export interface AgentTrace {
    id: string; // Firestore Doc ID
    userId: string;
    agentId: string; // 'orchestrator', 'legal', etc.
    input: string; // Original user input
    status: TraceStatus;
    startTime: any; // Firestore Timestamp
    endTime?: any; // Firestore Timestamp
    steps: TraceStep[];
    metadata?: Record<string, any>; // Helper for querying (e.g., projectId)
    error?: string;
}
