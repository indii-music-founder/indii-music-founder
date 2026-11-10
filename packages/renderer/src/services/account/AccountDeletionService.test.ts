import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteUserAccount } from './AccountDeletionService';

// ============================================================================
// Mocks
// ============================================================================

const mockCallableFn = vi.fn();
const mockHttpsCallable = vi.fn(() => mockCallableFn);

vi.mock('@/lib/auditLogChain', () => ({
    writeAuditLog: vi.fn().mockResolvedValue('audit-entry-1'),
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: (...args: [unknown, string]) => (mockHttpsCallable as any)(...args),
}));

const { writeAuditLog } = await import('@/lib/auditLogChain');
const { auth } = await import('@/services/firebase');

describe('AccountDeletionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockCallableFn.mockResolvedValue({
            data: {
                success: true,
                deletedDocs: 42,
                errors: [],
                deletedAt: new Date().toISOString(),
            },
        });

        Object.defineProperty(auth, 'currentUser', {
            value: { uid: 'user-123', email: 'test@example.com' },
            writable: true,
            configurable: true,
        });

        auth.signOut = vi.fn().mockResolvedValue(undefined);
    });

    describe('successful deletion', () => {
        it('calls requestAccountDeletion Cloud Function and cleans up local auth', async () => {
            const result = await deleteUserAccount('user-123', 'test@example.com');

            expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'requestAccountDeletion');
            expect(mockCallableFn).toHaveBeenCalledWith({});
            expect(result.success).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.deletedCollections[0]).toContain('users/ (42 docs');
            expect(auth.signOut).toHaveBeenCalled();
        });

        it('writes a tamper-evident audit log before deletion', async () => {
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
            const result = await deleteUserAccount('user-123', 'test@example.com');

            expect(result.pendingExternalActions).toContain('Stripe customer deletion (stripe.customers.del)');
            expect(result.pendingExternalActions).toContain('Sentry user data removal');
            expect(result.pendingExternalActions).toContain('Distribution partner data removal requests');
        });
    });

    describe('partial failures and safety guards', () => {
        it('continues deletion when audit log fails', async () => {
            vi.mocked(writeAuditLog).mockRejectedValueOnce(new Error('Audit log DB down'));

            const result = await deleteUserAccount('user-123', 'test@example.com');

            expect(result.success).toBe(true);
            expect(mockCallableFn).toHaveBeenCalled();
            expect(auth.signOut).toHaveBeenCalled();
        });

        it('records errors when Cloud Function reports backend erasure failure and preserves auth session', async () => {
            mockCallableFn.mockResolvedValueOnce({
                data: {
                    success: false,
                    deletedDocs: 0,
                    errors: ['storage_bucket: Permission denied on GCS'],
                    deletedAt: new Date().toISOString(),
                },
            });

            const result = await deleteUserAccount('user-123', 'test@example.com');

            expect(result.success).toBe(false);
            expect(result.errors).toContain('storage_bucket: Permission denied on GCS');
            // Auth session should NOT be deleted if backend failed
            expect(auth.signOut).not.toHaveBeenCalled();
        });

        it('records error when Cloud Function rejects with network or internal exception', async () => {
            mockCallableFn.mockRejectedValueOnce(new Error('Cloud Function timeout'));

            const result = await deleteUserAccount('user-123', 'test@example.com');

            expect(result.success).toBe(false);
            expect(result.errors[0]).toContain('Cloud Function requestAccountDeletion failed: Cloud Function timeout');
            expect(auth.signOut).not.toHaveBeenCalled();
        });

        it('reports error when user is not signed in', async () => {
            Object.defineProperty(auth, 'currentUser', {
                value: null,
                writable: true,
                configurable: true,
            });

            const result = await deleteUserAccount('user-123', 'test@example.com');

            expect(result.success).toBe(false);
            expect(result.errors).toContain('Cannot delete auth account: user not currently signed in');
            expect(mockCallableFn).not.toHaveBeenCalled();
        });

        it('reports error when signed-in user UID does not match requested userId', async () => {
            Object.defineProperty(auth, 'currentUser', {
                value: { uid: 'different-user', email: 'diff@example.com' },
                writable: true,
                configurable: true,
            });

            const result = await deleteUserAccount('user-123', 'test@example.com');

            expect(result.success).toBe(false);
            expect(result.errors).toContain('Cannot delete auth account: user not currently signed in');
            expect(mockCallableFn).not.toHaveBeenCalled();
        });
    });

    describe('result structure', () => {
        it('returns proper DeletionResult interface', async () => {
            const result = await deleteUserAccount('user-123', 'test@example.com');

            expect(result).toHaveProperty('success');
            expect(result).toHaveProperty('deletedCollections');
            expect(result).toHaveProperty('deletedStorageFiles');
            expect(result).toHaveProperty('errors');
            expect(result).toHaveProperty('pendingExternalActions');
            expect(Array.isArray(result.deletedCollections)).toBe(true);
            expect(Array.isArray(result.errors)).toBe(true);
            // Structural-only: the mocked response does not establish deletion.
            expect(result.deletedStorageFiles).toBeNull();
        });
    });
});
