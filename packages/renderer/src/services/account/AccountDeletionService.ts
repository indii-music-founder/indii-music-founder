import { auth, functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { logger } from '@/utils/logger';
import { writeAuditLog } from '@/lib/auditLogChain';

/**
 * Item 306: GDPR Article 17 — Right to Erasure ("Delete My Account")
 *
 * Removes all user data via the authenticated Cloud Function `requestAccountDeletion`:
 *   1. Firestore: user profile, all subcollections (recursive delete via firebase-admin),
 *      and root collection documents owned by the user.
 *   2. Firebase Storage: all files under users/{uid}/, tax_docs/{uid}/, and masters/{uid}/.
 *   3. Firebase Auth: the authentication account itself (via admin.auth().deleteUser).
 *
 * External services (Stripe customer deletion, Sentry user removal) are tracked
 * as pending actions and completed via backend webhooks/workers.
 *
 * GDPR requires this to complete within 30 days of request.
 */

export interface DeletionResult {
    success: boolean;
    deletedCollections: string[];
    /** The server currently does not return an object count. */
    deletedStorageFiles: number | null;
    errors: string[];
    pendingExternalActions: string[];
}

interface BackendDeletionResponse {
    success: boolean;
    deletedDocs: number;
    errors: string[];
    deletedAt: string;
}

/**
 * Execute the full account deletion flow.
 *
 * @param userId - The Firebase UID of the user to delete
 * @param userEmail - The user's email (for audit purposes)
 */
export async function deleteUserAccount(userId: string, userEmail: string): Promise<DeletionResult> {
    const result: DeletionResult = {
        success: false,
        deletedCollections: [],
        deletedStorageFiles: null,
        errors: [],
        pendingExternalActions: [
            'Stripe customer deletion (stripe.customers.del)',
            'Sentry user data removal',
            'Distribution partner data removal requests',
        ],
    };

    logger.info(`[AccountDeletion] Starting GDPR account deletion for user: ${userId} (${userEmail})`);

    // Verify user is signed in as the requested userId
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== userId) {
        const errorMsg = 'Cannot delete auth account: user not currently signed in';
        result.errors.push(errorMsg);
        logger.error(`[AccountDeletion] ${errorMsg}`);
        return result;
    }

    // Step 1: Write pre-deletion audit log BEFORE erasure (so we have a tamper-evident record)
    try {
        await writeAuditLog(userId, 'account.deletion_requested', {
            email: userEmail,
            requestedAt: new Date().toISOString(),
            source: 'user_self_service',
        });
    } catch {
        // Audit log failure shouldn't block deletion
        logger.warn('[AccountDeletion] Failed to write pre-deletion audit log');
    }

    // Step 2: Delegate to authenticated Cloud Function for recursive server-side erasure
    try {
        const deletionCallable = httpsCallable<Record<string, unknown>, BackendDeletionResponse>(
            functions,
            'requestAccountDeletion'
        );
        const response = await deletionCallable({});
        const data = response.data;

        if (data && data.success) {
            result.deletedCollections.push(`users/ (${data.deletedDocs || 0} docs across profile and subcollections)`);
            result.success = true;
            logger.info(`[AccountDeletion] Backend GDPR erasure succeeded for user ${userId}. docs=${data.deletedDocs}`);
        } else if (data && data.errors && data.errors.length > 0) {
            result.errors.push(...data.errors);
            logger.error(`[AccountDeletion] Backend reported erasure errors: ${data.errors.join('; ')}`);
        } else {
            result.errors.push('Account deletion returned incomplete status from backend.');
        }
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Cloud Function requestAccountDeletion failed: ${msg}`);
        logger.error(`[AccountDeletion] Failed to execute backend erasure: ${msg}`);
    }

    // Step 3: Clean up client auth session only if backend deletion succeeded
    if (result.success) {
        try {
            await auth.signOut();
            logger.info(`[AccountDeletion] Local auth session terminated for ${userId}`);
        } catch (error: unknown) {
            logger.warn(`[AccountDeletion] Client sign out notice: ${error}`);
        }
    }

    result.success = result.errors.length === 0;
    logger.info(`[AccountDeletion] Deletion ${result.success ? 'complete' : 'completed with errors'} for ${userId}`);
    return result;
}
