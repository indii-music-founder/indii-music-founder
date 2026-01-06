
import { FirestoreService } from '../FirestoreService';
import { ConversationSession } from '@/core/store/slices/agentSlice'; // Direct import to avoid circular dep risks? Or from index?
import { OrganizationService } from '../OrganizationService';
import { auth } from '../firebase';
import { where, orderBy, limit, Timestamp } from 'firebase/firestore';

// Define the Firestore document shape (handling timestamps)
interface SessionDocument extends Omit<ConversationSession, 'createdAt' | 'updatedAt'> {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    userId: string;
    orgId: string;
}

class SessionServiceImpl extends FirestoreService<SessionDocument> {
    constructor() {
        super('sessions');
    }

    async createSession(session: ConversationSession): Promise<string> {
        const orgId = OrganizationService.getCurrentOrgId() || 'personal';
        const userId = auth.currentUser?.uid || 'anonymous';

        const doc: SessionDocument = {
            ...session,
            createdAt: Timestamp.fromMillis(session.createdAt),
            updatedAt: Timestamp.fromMillis(session.updatedAt),
            userId,
            orgId
        };

        // We use set since we already generated an ID in the store
        await this.set(session.id, doc);
        return session.id;
    }

    async updateSession(id: string, updates: Partial<ConversationSession>): Promise<void> {
        const firestoreUpdates: any = { ...updates };
        if (updates.updatedAt) {
            firestoreUpdates.updatedAt = Timestamp.fromMillis(updates.updatedAt);
        }
        // createdAt should not be updated usually, but if so:
        if (updates.createdAt) {
            // careful not to overwrite
            delete firestoreUpdates.createdAt;
        }

        await this.update(id, firestoreUpdates);
    }

    async getSessionsForUser(): Promise<ConversationSession[]> {
        const orgId = OrganizationService.getCurrentOrgId() || 'personal';
        const userId = auth.currentUser?.uid;

        if (!userId) return [];

        const constraints = [
            where('orgId', '==', orgId),
            where('userId', '==', userId), // Strict ownership for now? Or participants?
            orderBy('updatedAt', 'desc'),
            limit(50)
        ];

        const docs = await this.list(constraints);
        return docs.map(d => ({
            ...d,
            createdAt: d.createdAt.toMillis(),
            updatedAt: d.updatedAt.toMillis()
        }));
    }
}

export const sessionService = new SessionServiceImpl();
