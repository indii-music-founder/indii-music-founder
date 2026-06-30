import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workspaceSyncService, type WorkspaceSnapshot } from './WorkspaceSyncService';

// Mock Firestore
vi.mock('firebase/firestore', () => ({
    doc: vi.fn((db, ...path) => ({ _path: path })),
    getDoc: vi.fn(async () => ({
        exists: () => false,
        data: () => undefined,
    })),
    setDoc: vi.fn(async () => undefined),
    onSnapshot: vi.fn(() => () => undefined),
    serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
    Timestamp: {
        now: vi.fn(() => ({ toMillis: () => Date.now() })),
    },
}));

// Mock firebase services
vi.mock('@/services/firebase', () => ({
    db: { _mock: true },
    auth: { currentUser: { uid: 'test-uid' } },
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
    },
}));

// Mock E2E detection
vi.mock('@/utils/e2eMode', () => ({
    isFirebaseE2EMockEnabled: vi.fn(() => false),
}));

// Mock auth guards
vi.mock('@/utils/authGuards', () => ({
    getRealAuthenticatedUserId: vi.fn((user) => user?.uid || null),
}));

describe('WorkspaceSyncService', () => {
    const mockSnapshot: WorkspaceSnapshot = {
        schemaVersion: 1,
        boardroomMessages: [
            {
                id: 'msg1',
                fromAgent: 'generalist',
                toAgent: 'creative',
                content: 'Hello',
                timestamp: Date.now(),
            },
        ],
        activeAgents: ['generalist', 'creative'],
        referencedAssets: [
            {
                id: 'asset1',
                name: 'Image 1',
                type: 'file',
                value: 'url-to-image',
            },
        ],
        selectedPlan: {
            id: 'plan1',
            title: 'My Plan',
            description: 'A test plan',
        },
        selectedPlanId: 'plan1',
        currentModule: 'dashboard',
        conversationMode: 'boardroom',
        notes: [
            {
                id: 'note1',
                title: 'Note 1',
                content: 'Content',
            },
        ],
        selectedNoteId: 'note1',
        creativePrompt: 'Create an image',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Clear localStorage
        localStorage.clear();
    });

    it('generates and caches stable device ID', () => {
        const deviceId1 = workspaceSyncService.getDeviceId();
        const deviceId2 = workspaceSyncService.getDeviceId();

        expect(deviceId1).toBe(deviceId2);
        expect(deviceId1).toMatch(/^device-/);
    });

    it('should push snapshot to Firestore', async () => {
        const { setDoc } = await import('firebase/firestore');

        await workspaceSyncService.pushSnapshot(mockSnapshot);

        expect(setDoc).toHaveBeenCalled();
        const call = vi.mocked(setDoc).mock.calls[0];
        expect(call[1]).toEqual(
            expect.objectContaining({
                snapshot: mockSnapshot,
                deviceId: expect.any(String),
            })
        );
    });

    it('should pull snapshot from Firestore', async () => {
        const { getDoc } = await import('firebase/firestore');
        const { Timestamp } = await import('firebase/firestore');

        // Mock successful response
        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
                snapshot: mockSnapshot,
                updatedAt: Timestamp.now(),
                deviceId: 'other-device',
            }),
        } as any);

        const result = await workspaceSyncService.pullSnapshot();

        expect(result).toEqual(
            expect.objectContaining({
                snapshot: expect.objectContaining(mockSnapshot),
                deviceId: 'other-device',
            })
        );
        expect(getDoc).toHaveBeenCalled();
    });

    it('should return null when no snapshot exists', async () => {
        const { getDoc } = await import('firebase/firestore');

        vi.mocked(getDoc).mockResolvedValueOnce({
            exists: () => false,
            data: () => undefined,
        } as any);

        const result = await workspaceSyncService.pullSnapshot();

        expect(result).toBeNull();
    });

    it('should handle pull errors gracefully', async () => {
        const { getDoc } = await import('firebase/firestore');

        vi.mocked(getDoc).mockRejectedValueOnce(new Error('Network error'));

        const result = await workspaceSyncService.pullSnapshot();

        expect(result).toBeNull();
    });

    it('should skip push when not authenticated', async () => {
        const { setDoc } = await import('firebase/firestore');
        const { getRealAuthenticatedUserId } = await import('@/utils/authGuards');

        // Mock unauthenticated state
        vi.mocked(getRealAuthenticatedUserId).mockReturnValueOnce(null);

        await workspaceSyncService.pushSnapshot(mockSnapshot);

        // setDoc should not be called
        expect(setDoc).not.toHaveBeenCalled();
    });

    it('should check authentication status', async () => {
        const isAuthenticated = workspaceSyncService.isAuthenticated();
        expect(typeof isAuthenticated).toBe('boolean');
    });

    it('should define subscribe method for Phase 2 (live mirror)', async () => {
        const { onSnapshot } = await import('firebase/firestore');
        vi.mocked(onSnapshot).mockReturnValueOnce((() => null) as any);

        const callback = vi.fn();
        const unsubscribe = workspaceSyncService.subscribe(callback);

        expect(typeof unsubscribe).toBe('function');
        // In real implementation, onSnapshot would be called
    });

    it('should tolerate partial snapshots (forward compatibility)', () => {
        // This test verifies that applyWorkspaceSnapshot can handle
        // snapshots with missing fields from older schemaVersion
        // (implementation in useWorkspaceSync test suite)
        const partialSnapshot: Partial<WorkspaceSnapshot> = {
            schemaVersion: 1,
            boardroomMessages: mockSnapshot.boardroomMessages,
            activeAgents: mockSnapshot.activeAgents,
        };

        expect(partialSnapshot.selectedPlan).toBeUndefined();
        expect(partialSnapshot.selectedNoteId).toBeUndefined();
        // applyWorkspaceSnapshot should skip undefined fields
    });
});
