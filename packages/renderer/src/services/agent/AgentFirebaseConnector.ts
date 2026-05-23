import { FirestoreService } from '@/services/FirestoreService';
import { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { Timestamp } from 'firebase/firestore';

/**
 * Interface representing the Firestore database schema for a boardroom message.
 * Converts milliseconds timestamps into Firestore Timestamps.
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
}

/**
 * AgentFirebaseConnector
 *
 * Implements real-time synchronized persistence of courtroom and boardroom swarm events
 * directly to the 'boardroom_messages' Firestore collection.
 */
class AgentFirebaseConnectorImpl extends FirestoreService<BoardroomMessageDocument> {
    constructor() {
        super('boardroom_messages');
    }

    /**
     * Synchronizes a courtroom or boardroom message to Firestore.
     * Maps local store memory representations to Firestore-friendly formats.
     */
    async syncMessage(msg: AgentMessage): Promise<void> {
        try {
            const userId = auth.currentUser?.uid || 'founder-demo-uid';

            // Clean thoughts, converting timestamps to Firestore Timestamps
            const cleanedThoughts = msg.thoughts?.map(thought => ({
                id: thought.id,
                text: thought.text,
                timestamp: Timestamp.fromMillis(thought.timestamp || Date.now()),
                type: thought.type,
                toolName: thought.toolName
            })) || [];

            const docData: BoardroomMessageDocument = {
                id: msg.id,
                role: msg.role,
                text: msg.text || '',
                timestamp: Timestamp.fromMillis(msg.timestamp || Date.now()),
                userId,
                thoughts: cleanedThoughts,
                isStreaming: msg.isStreaming ?? false
            };

            if (msg.agentId) docData.agentId = msg.agentId;
            if (msg.thoughtSignature) docData.thoughtSignature = msg.thoughtSignature;
            if (msg.source) docData.source = msg.source;
            if (msg.metadata) docData.metadata = msg.metadata;
            if (msg.planId) docData.planId = msg.planId;
            if (msg.attachments) docData.attachments = msg.attachments;

            // Save using merge set to ensure updates to existing messages do not destroy fields
            await this.set(msg.id, docData);
            logger.debug(`[AgentFirebaseConnector] Successfully synced message ${msg.id} to Firestore.`);
        } catch (error: unknown) {
            logger.error(`[AgentFirebaseConnector] Failed to sync message ${msg.id} to Firestore:`, error);
        }
    }
}

export const agentFirebaseConnector = new AgentFirebaseConnectorImpl();
