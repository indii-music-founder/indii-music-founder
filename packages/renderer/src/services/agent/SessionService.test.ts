import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 1. Mock External Dependencies (Firebase/Firestore)
vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    Timestamp: {
        fromMillis: (ms: number) => ({ toMillis: () => ms, seconds: ms / 1000, nanoseconds: 0 }),
        now: () => ({
  serverTimestamp: vi.fn(), toMillis: () => Date.now() })
    }
}));

// 2. Mock FirestoreService Base Class
const { mockSet, mockUpdate, mockDelete, mockList } = vi.hoisted(() => ({
  serverTimestamp: vi.fn(),
    mockSet: vi.fn().mockResolvedValue(undefined),
    mockUpdate: vi.fn().mockResolvedValue(undefined),
    mockDelete: vi.fn().mockResolvedValue(undefined),
    mockList: vi.fn().mockResolvedValue([])
}));

vi.mock('../FirestoreService', () => {
    return {
    serverTimestamp: vi.fn(),
        FirestoreService: class {
            set = mockSet;
            update = mockUpdate;
            delete = mockDelete;
            list = mockList;
            constructor(collectionPath: string) {}
        }
    };
});

// 3. Mock Auth & Org Services
vi.mock('../firebase', () => ({
  serverTimestamp: vi.fn(),
    auth: { currentUser: { uid: 'test-user-id' } }
}));

vi.mock('../OrganizationService', () => ({
  serverTimestamp: vi.fn(),
    OrganizationService: {
        getCurrentOrgId: () => 'test-org-id'
    }
}));

// 4. Import System Under Test
import { sessionService } from './SessionService';
import { ConversationSession } from '@/core/store/slices/agent';

describe('SessionService Persistence (Dual Write)', () => {
    const mockElectronSave = vi.fn().mockResolvedValue(undefined);
    const mockElectronDelete = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup window.electronAPI mock
        vi.stubGlobal('window', {
            electronAPI: {
                agent: {
                    saveHistory: mockElectronSave,
                    deleteHistory: mockElectronDelete
                }
            }
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('createSession should save to Firestore AND Electron', async () => {
        const session: ConversationSession = {
            id: 'session-123',
            title: 'Test Chat',
            createdAt: 1000,
            updatedAt: 1000,
            messages: [],
            participants: ['indii']
        };

        await sessionService.createSession(session);

        // Verify Firestore (Cloud)
        expect(mockSet).toHaveBeenCalledWith('session-123', expect.objectContaining({
            userId: 'test-user-id',
            orgId: 'test-org-id'
        }));

        // Verify Electron (Local)
        expect(mockElectronSave).toHaveBeenCalledWith('session-123', session);
    });

    it('updateSession should update Firestore AND Electron', async () => {
        const updates = { title: 'New Title', updatedAt: 2000 };
        await sessionService.updateSession('session-123', updates);

        // Verify Firestore (Cloud)
        expect(mockUpdate).toHaveBeenCalledWith('session-123', expect.any(Object));

        // Verify Electron (Local)
        expect(mockElectronSave).toHaveBeenCalledWith('session-123', updates);
    });

    it('deleteSession should delete from Firestore AND Electron', async () => {
        await sessionService.deleteSession('session-123');

        // Verify Firestore (Cloud)
        expect(mockDelete).toHaveBeenCalledWith('session-123');

        // Verify Electron (Local)
        expect(mockElectronDelete).toHaveBeenCalledWith('session-123');
    });

    it('should handle missing electronAPI gracefully', async () => {
        // Remove electronAPI from window
        vi.stubGlobal('window', {});

        const session: ConversationSession = {
            id: 'session-456',
            title: 'Web Only Chat',
            createdAt: 1000,
            updatedAt: 1000,
            messages: [],
            participants: ['indii']
        };

        // Should not throw error
        await expect(sessionService.createSession(session)).resolves.not.toThrow();

        expect(mockSet).toHaveBeenCalled();
        expect(mockElectronSave).not.toHaveBeenCalled();
    });
});
