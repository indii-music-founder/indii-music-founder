import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';

export interface ScreenwriterDraftPayload {
    activeTab: 'scriptwriter' | 'storyboard' | 'veoprompts';
    songConcept: string;
    selectedTone: 'cinematic' | 'abstract' | 'hype';
    scenes: Array<{ id: string; sceneNumber: number; heading: string; description: string; cameraAngle: string; duration: number; veoPrompt: string }>;
    selectedSceneId: string;
}

export interface PersistedScreenwriterDraft {
    payload: ScreenwriterDraftPayload;
    revision: number;
}

export class ScreenwriterDraftConflictError extends Error {
    constructor(public readonly current: PersistedScreenwriterDraft) {
        super('This screenwriter draft changed on another device. Review and choose which version to keep.');
    }
}

class ScreenwriterDraftService {
    private ref(userId: string, projectId: string) {
        return doc(db, 'users', userId, 'screenwriterDrafts', projectId);
    }

    async load(userId: string, projectId: string): Promise<PersistedScreenwriterDraft | null> {
        const snapshot = await getDoc(this.ref(userId, projectId));
        if (!snapshot.exists()) return null;
        const data = snapshot.data() as { payload?: ScreenwriterDraftPayload; revision?: unknown };
        if (!data.payload || typeof data.revision !== 'number') return null;
        return { payload: data.payload, revision: data.revision };
    }

    async save(userId: string, projectId: string, payload: ScreenwriterDraftPayload, expectedRevision: number | null): Promise<number> {
        const ref = this.ref(userId, projectId);
        return runTransaction(db, async transaction => {
            const current = await transaction.get(ref);
            const data = current.data() as { payload?: ScreenwriterDraftPayload; revision?: unknown } | undefined;
            const currentRevision = typeof data?.revision === 'number' ? data.revision : null;
            if (currentRevision !== expectedRevision && !(currentRevision === null && expectedRevision === null)) {
                if (data?.payload && currentRevision !== null) throw new ScreenwriterDraftConflictError({ payload: data.payload, revision: currentRevision });
                throw new Error('Screenwriter draft revision is invalid.');
            }
            const nextRevision = (currentRevision ?? 0) + 1;
            transaction.set(ref, { ownerId: userId, projectId, payload, revision: nextRevision, updatedAt: serverTimestamp() }, { merge: false });
            return nextRevision;
        });
    }
}

export const screenwriterDraftService = new ScreenwriterDraftService();
