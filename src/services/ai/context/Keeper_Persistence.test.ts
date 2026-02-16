
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ----------------------------------------------------------------------------
// Mocks - MUST BE HOISTED
// ----------------------------------------------------------------------------

// Mock Firebase Modules
vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(() => ({})),
    getApp: vi.fn(() => ({})),
    getApps: vi.fn(() => [])
}));

vi.mock('firebase/auth', async (importOriginal) => {
    return {
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
    return {
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
        setDoc: vi.fn(),
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

vi.mock('firebase/storage', () => ({
    getStorage: vi.fn(() => ({}))
}));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    connectFunctionsEmulator: vi.fn(),
    httpsCallable: vi.fn()
}));

vi.mock('firebase/app-check', () => ({
    initializeAppCheck: vi.fn(),
    ReCaptchaEnterpriseProvider: vi.fn()
}));

vi.mock('firebase/remote-config', () => ({
    getRemoteConfig: vi.fn(() => ({}))
}));

vi.mock('firebase/ai', () => ({
    getAI: vi.fn(),
    VertexAIBackend: vi.fn()
}));

vi.mock('@/services/OrganizationService', () => ({
    OrganizationService: {
        getCurrentOrgId: vi.fn(() => 'test-org')
    }
}));

// Mock window.electronAPI
const mockSaveHistory = vi.fn().mockResolvedValue({ success: true });
const mockDeleteHistory = vi.fn().mockResolvedValue({ success: true });

// ----------------------------------------------------------------------------
// Test Suite
// ----------------------------------------------------------------------------

import { sessionService } from '@/services/agent/SessionService';

describe('📚 Keeper: Persistence (Electron Local Storage)', () => {

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
        await sessionService.createSession(newSession as any);

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
        await sessionService.updateSession(sessionId, updates as any);

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
