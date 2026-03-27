import { Timestamp } from 'firebase/firestore';

export type DirectiveStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_HANDSHAKE' | 'COMPLETED' | 'CANCELLED';

export type AgentRole = 'indii' | 'indiiOD' | 'CreativeDirector' | 'ExecutorAgent' | 'GeneralistAgent' | string;

export interface ComputeAllocation {
    maxTokens: number;
    tokensUsed: number;
    isMaximizerModeActive: boolean;
}

export interface ConversationMessage {
    role: 'user' | 'agent' | 'system';
    content: string;
    timestamp: Timestamp;
}

export interface GoalAncestry {
    type: 'intent' | 'strategy' | 'task' | 'subtask';
    description: string;
    id: string;
}

export interface Directive {
    id: string;
    userId: string;
    title: string;
    status: DirectiveStatus;
    assignedAgent: AgentRole;
    goalAncestry: GoalAncestry[];
    computeAllocation: ComputeAllocation;
    contextFiles: string[];
    conversationThread: ConversationMessage[];
    requiresDigitalHandshake: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
