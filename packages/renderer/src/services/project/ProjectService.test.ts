import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProjectService } from './ProjectService';

const mocks = vi.hoisted(() => ({
    auth: { currentUser: null as { uid: string; isAnonymous?: boolean } | null },
    addDoc: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    auth: mocks.auth,
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    updateDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    deleteDoc: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: 1, nanoseconds: 0 })),
    addDoc: mocks.addDoc,
    Timestamp: class Timestamp { },
}));

describe('ProjectService auth guards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.auth.currentUser = null;
    });

    it('rejects anonymous users even when they have a Firebase UID', async () => {
        mocks.auth.currentUser = { uid: 'anon-user', isAnonymous: true };

        await expect(ProjectService.create('anon-user', 'Inbox')).rejects.toThrow('real authenticated user');
        expect(mocks.addDoc).not.toHaveBeenCalled();
    });

    it('rejects founder demo user IDs', async () => {
        await expect(ProjectService.ensureInbox('founder-demo-uid')).rejects.toThrow('real authenticated user');
    });
});
