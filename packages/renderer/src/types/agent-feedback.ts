import { Timestamp } from 'firebase/firestore';

export type FeedbackRating = 'positive' | 'negative' | 'neutral';

export interface AgentActionContext {
    agentId: string;        // The agent that suggested this (e.g., 'marketing', 'distribution')
    actionType: string;     // Type of artifact/suggestion (e.g., 'strategy_plan')
    promptId?: string;      // ID linking to the specific prompt thread (optional)
    contentSummary: string; // A short summary of what the agent proposed
}

export interface AgentFeedbackEvent {
    id: string;
    userId: string;
    createdAt: Timestamp;

    // The context of what the agent did
    actionContext: AgentActionContext;

    // The user's evaluation
    rating: FeedbackRating;
    comment?: string;

    // Processing state
    isProcessed: boolean;          // Has the AlignmentAgent parsed this into a Memory Rule?
    resultingMemoryId?: string;    // If processed, the ID of the generated UserMemory rule

    // Anti-harvesting: Opt-in sharing for the global Wisdom Pool
    sharedGlobally: boolean;
}
