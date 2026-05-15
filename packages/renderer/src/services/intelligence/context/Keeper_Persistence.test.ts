
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ----------------------------------------------------------------------------
// Mocks - MUST BE HOISTED
// ----------------------------------------------------------------------------

// Mock Firebase Modules
vi.mock('firebase/app', () => ({
    serverTimestamp: vi.fn(),
    initializeApp: vi.fn(() => ({
        serverTimestamp: vi.fn(),
    })),
    getApp: vi.fn(() => ({
        serverTimestamp: vi.fn(),
    })),
    getApps: vi.fn(() => [])
}));

vi.mock('firebase/auth', async (importOriginal) => {
    return {
        serverTimestamp: vi.fn(),
        getAuth: vi.fn(() => ({
            serverTimestamp: vi.fn(),
            currentUser: { uid: 'test-user', getIdToken: vi.fn().mockResolvedValue('test-token') }
        })),
        initializeAuth: vi.fn(() => ({
            serverTimestamp: vi.fn(),
        })),
        onAuthStateChanged: vi.fn(),
        browserLocalPersistence: {},
        browserSessionPersistence: {},
        indexedDBLocalPersistence: {}
    };
});

vi.mock('firebase/firestore', async (importOriginal) => {
    return {
        serverTimestamp: vi.fn(),
        Timestamp: {
            now: () => ({
                serverTimestamp: vi.fn(), toMillis: () => Date.now(), seconds: Math.floor(Date.now() / 1000), nanoseconds: 0
            }),
            fromDate: (date: Date) => ({ toMillis: () => date.getTime(), seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 }),
            fromMillis: (ms: number) => ({ toMillis: () => ms, seconds: Math.floor(ms / 1000), nanoseconds: 0 })
        },
        getFirestore: vi.fn(() => ({
            serverTimestamp: vi.fn(),
        })),
        initializeFirestore: vi.fn(() => ({
            serverTimestamp: vi.fn(),
        })),
        persistentLocalCache: vi.fn(),
        persistentMultipleTabManager: vi.fn(),
        doc: vi.fn(),
        setDoc: vi.fn(),
        getDoc: vi.fn(),
        collection: vi.fn(),
        onSnapshot: vi.fn(),
        writeBatch: vi.fn(() => ({
            serverTimestamp: vi.fn(), commit: vi.fn()
        })),
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
    serverTimestamp: vi.fn(),
    getStorage: vi.fn(() => ({
        serverTimestamp: vi.fn(),
    }))
}));

vi.mock('firebase/functions', () => ({
    serverTimestamp: vi.fn(),
    getFunctions: vi.fn(() => ({
        serverTimestamp: vi.fn(),
    })),
    connectFunctionsEmulator: vi.fn(),
    httpsCallable: vi.fn()
}));

vi.mock('firebase/app-check', () => ({
    serverTimestamp: vi.fn(),
    initializeAppCheck: vi.fn(),
    ReCaptchaEnterpriseProvider: vi.fn()
}));

vi.mock('firebase/remote-config', () => ({
    serverTimestamp: vi.fn(),
    getRemoteConfig: vi.fn(() => ({
        serverTimestamp: vi.fn(),
    }))
}));

vi.mock('firebase/ai', () => ({
    serverTimestamp: vi.fn(),
    getAI: vi.fn(),
    VertexAIBackend: vi.fn()
}));

vi.mock('@/services/OrganizationService', () => ({
    serverTimestamp: vi.fn(),
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
        await sessionService.createSession(newSession as unknown as Parameters<typeof sessionService.createSession>[0]);

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
        await sessionService.updateSession(sessionId, updates as unknown as Parameters<typeof sessionService.updateSession>[1]);

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
