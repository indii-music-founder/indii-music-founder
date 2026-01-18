
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionService } from '@/services/agent/SessionService'; // Direct import of class if possible, or module

// Mock Firebase Modules
vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(() => ({})),
    getApp: vi.fn(() => ({})),
    getApps: vi.fn(() => [])
}));

vi.mock('firebase/auth', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        getAuth: vi.fn(() => ({
            currentUser: { uid: 'test-user', getIdToken: vi.fn().mockResolvedValue('test-token') }
        })),
        initializeAuth: vi.fn(() => ({})),
        onAuthStateChanged: vi.fn(),
        browserLocalPersistence: {},
        browserSessionPersistence: {},
        indexedDBLocalPersistence: {}
    };
});

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        Timestamp: {
            now: () => ({ toMillis: () => Date.now(), seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }),
            fromDate: (date: Date) => ({ toMillis: () => date.getTime(), seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 }),
            fromMillis: (ms: number) => ({ toMillis: () => ms, seconds: Math.floor(ms / 1000), nanoseconds: 0 })
        },
        getFirestore: vi.fn(() => ({})),
        initializeFirestore: vi.fn(() => ({})),
        persistentLocalCache: vi.fn(),
        persistentMultipleTabManager: vi.fn(),
        doc: vi.fn(),
        setDoc: vi.fn(), // Mock setDoc
        getDoc: vi.fn(),
        collection: vi.fn(),
        onSnapshot: vi.fn(),
        writeBatch: vi.fn(() => ({ commit: vi.fn() })),
        addDoc: vi.fn(),
        updateDoc: vi.fn(),
        deleteDoc: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        limit: vi.fn(),
        orderBy: vi.fn(),
        getDocs: vi.fn().mockResolvedValue({ docs: [] })
    }
});

vi.mock('@/services/OrganizationService', () => ({
    OrganizationService: {
        getCurrentOrgId: vi.fn(() => 'test-org')
    }
}));

// Mock window.electronAPI
const mockSaveHistory = vi.fn().mockResolvedValue({ success: true });
const mockDeleteHistory = vi.fn().mockResolvedValue({ success: true });

describe('📚 Keeper: Persistence (Electron Local Storage)', () => {
    let sessionService: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockSaveHistory.mockClear();
        mockDeleteHistory.mockClear();

        // Setup Global Window Mock for Electron
        vi.stubGlobal('window', {
            electronAPI: {
                agent: {
                    saveHistory: mockSaveHistory,
                    deleteHistory: mockDeleteHistory
                }
            }
        });

        // Re-import SessionService to ensure mocks are applied and window is seen
        // Note: In strict ESM this might be tricky, but we are using vitest.
        // We might need to access the singleton instance if it's already created.
        const module = await import('@/services/agent/SessionService');
        sessionService = module.sessionService;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should save session to Local File System when creating a session in Electron', async () => {
        const newSession = {
            id: 'session-123',
            title: 'Test Session',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [{ id: 'msg-1', role: 'user', text: 'Hello', timestamp: Date.now() }],
            participants: ['indii']
        };

        // Act
        await sessionService.createSession(newSession);

        // Assert: Check if Electron API was called
        expect(mockSaveHistory).toHaveBeenCalledTimes(1);
        expect(mockSaveHistory).toHaveBeenCalledWith(
            'session-123',
            expect.objectContaining({
                id: 'session-123',
                title: 'Test Session',
                messages: expect.arrayContaining([
                    expect.objectContaining({ id: 'msg-1', text: 'Hello' })
                ])
            })
        );
    });

    it('should save session to Local File System when updating a session in Electron', async () => {
        const sessionId = 'session-123';
        const updates = {
            messages: [
                { id: 'msg-1', role: 'user', text: 'Hello', timestamp: 1000 },
                { id: 'msg-2', role: 'model', text: 'Hi there', timestamp: 2000 }
            ]
        };

        // Act
        await sessionService.updateSession(sessionId, updates);

        // Assert
        expect(mockSaveHistory).toHaveBeenCalledTimes(1);

        expect(mockSaveHistory).toHaveBeenCalledWith(
            sessionId,
            expect.objectContaining({
                messages: expect.arrayContaining([
                    expect.objectContaining({ id: 'msg-1', text: 'Hello' }),
                    expect.objectContaining({ id: 'msg-2', text: 'Hi there' })
                ])
            })
        );
    });

    it('should delete session from Local File System when deleting a session in Electron', async () => {
        const sessionId = 'session-123';

        // Act
        await sessionService.deleteSession(sessionId);

        // Assert
        expect(mockDeleteHistory).toHaveBeenCalledTimes(1);
        expect(mockDeleteHistory).toHaveBeenCalledWith(sessionId);
    });
});
