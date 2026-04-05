import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteUserAccount } from './AccountDeletionService';

// ============================================================================
// Mocks — Firebase services are globally mocked in src/test/setup.ts
// ============================================================================

// Mock auditLogChain
vi.mock('@/lib/auditLogChain', () => ({
    writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Re-import after mocking to get references
const { writeAuditLog } = await import('@/lib/auditLogChain');
const { getDocs, deleteDoc } = await import('firebase/firestore');
const { listAll, deleteObject } = await import('firebase/storage');
const { auth } = await import('@/services/firebase');

describe('AccountDeletionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default: subcollections are empty
        vi.mocked(getDocs).mockResolvedValue({
            empty: true,
            docs: [],
            size: 0,
            metadata: { fromCache: false, hasPendingWrites: false },
            query: {} as never,
            forEach: vi.fn(),
            docChanges: vi.fn().mockReturnValue([]),
            toJSON: vi.fn(),
        } as unknown as Awaited<ReturnType<typeof getDocs>>);

        // Default: storage directory is empty
        vi.mocked(listAll).mockResolvedValue({
            items: [],
            prefixes: [],
        } as unknown as Awaited<ReturnType<typeof listAll>>);

        // Default: deleteDoc succeeds
        vi.mocked(deleteDoc).mockResolvedValue(undefined);
        vi.mocked(deleteObject).mockResolvedValue(undefined);
    });

    // ==========================================================================
    // Successful deletion
    // ==========================================================================

    describe('successful deletion', () => {
        it('returns success when all operations succeed with no data', async () => {
            // Mock auth.currentUser
            Object.defineProperty(auth, 'currentUser', {
                value: { uid: 'user-123', delete: vi.fn().mockResolvedValue(undefined) },
                writable: true,
                configurable: true,
            });

            const result = await deleteUserAccount('user-123', 'test@example.com');

            expect(result.success).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.deletedCollections).toContain('users/ (profile doc)');
            expect(result.pendingExternalActions.length).toBeGreaterThan(0);
        });

        it('writes an audit log before deletion', async () => {
            Object.defineProperty(auth, 'currentUser', {
                value: { uid: 'user-123', delete: vi.fn().mockResolvedValue(undefined) },
                writable: true,
                configurable: true,
            });

            await deleteUserAccount('user-123', 'test@example.com');

            expect(writeAuditLog).toHaveBeenCalledWith(
                'user-123',
                'account.deletion_requested',
                expect.objectContaining({
                    email: 'test@example.com',
                    source: 'user_self_service',
                })
            );
        });

        it('lists expected pending external actions', async () => {
            Object.defineProperty(auth, 'currentUser', {
                value: { uid: 'user-123', delete: vi.fn().mockResolvedValue(undefined) },
                writable: true,
                configurable: true,
            });

            const result = await deleteUserAccount('user-123', 'test@example.com');

            expect(result.pendingExternalActions).toContain('Stripe customer deletion (stripe.customers.del)');
            expect(result.pendingExternalActions).toContain('Sentry user data removal');
        });
    });

    // ==========================================================================
    // Partial failures
    // ==========================================================================

    describe('partial failures', () => {
        it('continues deletion when audit log fails', async () => {
            vi.mocked(writeAuditLog).mockRejectedValueOnce(new Error('Audit log DB down'));

            Object.defineProperty(auth, 'currentUser', {
                value: { uid: 'user-123', delete: vi.fn().mockResolvedValue(undefined) },
                writable: true,
                configurable: true,
            });

            const result = await deleteUserAccount('user-123', 'test@example.com');

            // Should still succeed — audit log failure is non-blocking
            expect(result.success).toBe(true);
        });

        it('records errors when subcollection deletion fails', async () => {
            vi.mocked(getDocs).mockRejectedValue(new Error('Permission denied'));

            Object.defineProperty(auth, 'currentUser', {
                value: { uid: 'user-123', delete: vi.fn().mockResolvedValue(undefined) },
                writable: true,
                configurable: true,
            });

            const result = await deleteUserAccount('user-123', 'test@example.com');

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Failed to delete');
        });

        it('reports error when user is not signed in for auth deletion', async () => {
            Object.defineProperty(auth, 'currentUser', {
                value: null,
                writable: true,
                configurable: true,
            });

            const result = await deleteUserAccount('user-123', 'test@example.com');

            expect(result.errors).toContain('Cannot delete auth account: user not currently signed in');
        });

        it('reports error when signed-in user UID does not match', async () => {
            Object.defineProperty(auth, 'currentUser', {
                value: { uid: 'different-user', delete: vi.fn() },
                writable: true,
                configurable: true,
            });

            const result = await deleteUserAccount('user-123', 'test@example.com');

            expect(result.errors).toContain('Cannot delete auth account: user not currently signed in');
        });
    });

    // ==========================================================================
    // DeletionResult structure
    // ==========================================================================

    describe('result structure', () => {
        it('returns proper DeletionResult interface', async () => {
            Object.defineProperty(auth, 'currentUser', {
                value: { uid: 'user-123', delete: vi.fn().mockResolvedValue(undefined) },
                writable: true,
                configurable: true,
            });

            const result = await deleteUserAccount('user-123', 'test@example.com');

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('deletedCollections');
            expect(result).toHaveProperty('deletedStorageFiles');
            expect(result).toHaveProperty('errors');
            expect(result).toHaveProperty('pendingExternalActions');
            expect(Array.isArray(result.deletedCollections)).toBe(true);
            expect(Array.isArray(result.errors)).toBe(true);
            expect(typeof result.deletedStorageFiles).toBe('number');
        });
    });
});
