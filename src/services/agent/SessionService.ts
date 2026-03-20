
import { FirestoreService } from '../FirestoreService';
import type { ConversationSession } from '@/core/store/slices/agent'; // Direct import to avoid circular dep risks? Or from index?
import { OrganizationService } from '../OrganizationService';
import { auth } from '../firebase';
import { where, orderBy, limit, Timestamp, onSnapshot, collection, query, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import { cleanFirestoreData } from '@/services/utils/firebase';
import { logger } from '@/utils/logger';

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
        await this.set(session.id, cleanFirestoreData(doc));

        // KEEPER: Dual Write for Electron Local Persistence
        this.saveToLocal(session.id, session);

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

        await this.update(id, cleanFirestoreData(firestoreUpdates));

        // KEEPER: Dual Write for Electron Local Persistence
        this.saveToLocal(id, updates);
    }

    async deleteSession(id: string): Promise<void> {
        await this.delete(id);

        // KEEPER: Dual Write for Electron Local Persistence (Forget)
        if (window.electronAPI?.agent?.deleteHistory) {
            window.electronAPI.agent.deleteHistory(id).catch((err: any) => {
                logger.error('[SessionService] Failed to delete local history:', err);
            });
        }
    }

    private saveToLocal(id: string, data: any) {
        if (window.electronAPI?.agent?.saveHistory) {
            // Fire and forget (or await if strict consistency needed)
            window.electronAPI.agent.saveHistory(id, data).catch((err: any) => {
                logger.error('[SessionService] Failed to save to local history:', err);
            });
        }
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

    subscribeToSessions(
        onUpdate: (sessions: ConversationSession[]) => void,
        onError: (error: Error) => void
    ): Unsubscribe {
        const orgId = OrganizationService.getCurrentOrgId() || 'personal';
        const userId = auth.currentUser?.uid;

        if (!userId) {
            onUpdate([]);
            return () => { };
        }

        const constraints = [
            where('orgId', '==', orgId),
            where('userId', '==', userId),
            orderBy('updatedAt', 'desc'),
            limit(50)
        ];

        const q = query(collection(db, 'sessions'), ...constraints);

        return onSnapshot(q, (snapshot) => {
            const sessions = snapshot.docs.map(doc => {
                const d = doc.data() as SessionDocument;
                return {
                    ...d,
                    id: doc.id,
                    createdAt: d.createdAt.toMillis(),
                    updatedAt: d.updatedAt.toMillis()
                } as ConversationSession;
            });
            onUpdate(sessions);
        }, onError);
    }
}

export const sessionService = new SessionServiceImpl();
