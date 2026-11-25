import { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { Timestamp } from 'firebase/firestore';

/**
 * Legacy representation of a Boardroom message document.
 * Session messages are now persisted directly under `sessions/{sessionId}/messages`
 * by SessionService (ISSUE-1674); the write-only `boardroom_messages` collection
 * is deprecated and no longer written to.
 */
export interface BoardroomMessageDocument extends Omit<AgentMessage, 'timestamp' | 'thoughts'> {
    timestamp: Timestamp;
    thoughts?: Array<{
        id: string;
        text: string;
        timestamp: Timestamp;
        type?: 'tool' | 'logic' | 'error' | 'tool_result';
        toolName?: string;
    }>;
    userId: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    rating?: number;
}

class AgentFirebaseConnectorImpl {
    /**
     * @deprecated ISSUE-1674 removed the write-only `boardroom_messages` collection.
     * Session messages persist via SessionService (`sessions/{sessionId}/messages`).
     */
    async syncMessage(_msg: AgentMessage): Promise<void> {
        return Promise.resolve();
    }
}

export const agentFirebaseConnector = new AgentFirebaseConnectorImpl();
