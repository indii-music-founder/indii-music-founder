import { FirestoreService } from '@/services/FirestoreService';
import { AgentMessage } from '@/core/store/slices/agent/agentSessionSlice';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { Timestamp, where, orderBy, query, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';

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
    rating?: number;
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
            const isE2EMode = isFirebaseE2EMockEnabled();
            if (isE2EMode) {
                logger.debug(`[AgentFirebaseConnector] Skipping Firestore sync for E2E message ${msg.id}.`);
                return;
            }

            const userId = auth.currentUser?.uid;
            if (!userId) {
                throw new Error('User must be authenticated to sync agent messages.');
            }

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
            if (msg.rating !== undefined) docData.rating = msg.rating;

            // Save using merge set to ensure updates to existing messages do not destroy fields
            await this.set(msg.id, docData);
            logger.debug(`[AgentFirebaseConnector] Successfully synced message ${msg.id} to Firestore.`);
        } catch (error: unknown) {
            logger.error(`[AgentFirebaseConnector] Failed to sync message ${msg.id} to Firestore:`, error);
            throw error;
        }
    }

    /**
     * Subscribe to all boardroom messages for the given user, ordered by timestamp ascending.
     * Returns an unsubscribe function. Calls onUpdate with the mapped AgentMessage array on each change.
     * ISSUE-602: Enables real-time cross-device sync of boardroom history via the boardroom_messages collection.
     */
    subscribeToUserMessages(
        userId: string,
        onUpdate: (messages: AgentMessage[]) => void,
        onError?: (error: Error) => void
    ): Unsubscribe {
        if (isFirebaseE2EMockEnabled()) {
            // E2E mode: emit empty list and return no-op unsubscribe
            onUpdate([]);
            return () => {};
        }

        const q = query(
            this.collection,
            where('userId', '==', userId),
            orderBy('timestamp', 'asc')
        );

        return onSnapshot(
            q,
            (snapshot) => {
                const messages: AgentMessage[] = snapshot.docs.map(docSnap => {
                    const data = docSnap.data() as BoardroomMessageDocument;
                    return {
                        ...data,
                        id: docSnap.id,
                        timestamp: data.timestamp?.toMillis?.() ?? Date.now(),
                        thoughts: data.thoughts?.map(t => ({
                            ...t,
                            timestamp: t.timestamp?.toMillis?.() ?? Date.now(),
                        })) ?? [],
                    } as AgentMessage;
                });
                onUpdate(messages);
            },
            (error) => {
                logger.error('[AgentFirebaseConnector] boardroom_messages subscription error:', error);
                if (onError) onError(error);
            }
        );
    }
}

export const agentFirebaseConnector = new AgentFirebaseConnectorImpl();
