export enum AgentTaskStateEnum {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}

export interface AgentTaskNode {
    id: string;
    toolName: string;
    arguments: Record<string, unknown>;
    state: AgentTaskStateEnum;
    result?: unknown;
    error?: string;
    dependencies: string[]; // Node IDs that must complete before this runs
}

export interface AgentTaskGraph {
    taskId: string;
    status: AgentTaskStateEnum;
    nodes: Record<string, AgentTaskNode>;
    createdAt: number;
    updatedAt: number;
}
