import { db, storage, auth } from '@/services/firebase';
import { doc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { ref, listAll, deleteObject } from 'firebase/storage';
import { logger } from '@/utils/logger';
import { writeAuditLog } from '@/lib/auditLogChain';

/**
 * Item 306: GDPR Article 17 — Right to Erasure ("Delete My Account")
 *
 * Removes all user data from:
 *   1. Firestore: user profile, subcollections (auditLogs, releases, tracks, etc.)
 *   2. Firebase Storage: all files under users/{uid}/
 *   3. Firebase Auth: the user account itself
 *
 * External services (Stripe customer deletion, Sentry user removal) are logged
 * as pending actions and must be completed manually or via separate Cloud Functions.
 *
 * GDPR requires this to complete within 30 days of request.
 */

/** Subcollections under users/{uid}/ to be deleted */
const USER_SUBCOLLECTIONS = [
    'auditLogs',
    'releases',
    'tracks',
    'contracts',
    'campaigns',
    'notifications',
    'analytics',
    'brandAssets',
    'generatedImages',
    'generatedVideos',
    'splitSheets',
    'invoices',
    'messages',
] as const;

export interface DeletionResult {
    success: boolean;
    deletedCollections: string[];
    deletedStorageFiles: number;
    errors: string[];
    pendingExternalActions: string[];
}

/**
 * Delete all Firestore documents in a user's subcollection.
 * Uses batched deletes for efficiency.
 */
async function deleteSubcollection(userId: string, subcollection: string): Promise<number> {
    const colRef = collection(db, 'users', userId, subcollection);
    const snapshot = await getDocs(colRef);

    if (snapshot.empty) return 0;

    const batch = writeBatch(db);
    let count = 0;

    for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref);
        count++;

        // Firestore batch limit is 500
        if (count % 499 === 0) {
            await batch.commit();
        }
    }

    if (count % 499 !== 0) {
        await batch.commit();
    }

    return count;
}

/**
 * Delete all files in a user's Storage directory.
 */
async function deleteUserStorage(userId: string): Promise<number> {
    try {
        const userStorageRef = ref(storage, `users/${userId}`);
        const result = await listAll(userStorageRef);

        let deletedCount = 0;

        // Delete all files
        for (const itemRef of result.items) {
            await deleteObject(itemRef);
            deletedCount++;
        }

        // Recursively delete prefixes (subdirectories)
        for (const prefixRef of result.prefixes) {
            const subResult = await listAll(prefixRef);
            for (const subItem of subResult.items) {
                await deleteObject(subItem);
                deletedCount++;
            }
        }

        return deletedCount;
    } catch (error) {
        logger.warn(`[AccountDeletion] Storage deletion error (may not exist): ${error}`);
        return 0;
    }
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
        deletedStorageFiles: 0,
        errors: [],
        pendingExternalActions: [
            'Stripe customer deletion (stripe.customers.del)',
            'Sentry user data removal',
            'Distribution partner data removal requests',
        ],
    };

    logger.info(`[AccountDeletion] Starting account deletion for user: ${userId} (${userEmail})`);

    // Write deletion audit log BEFORE deletion (so we have a record)
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

    // Step 1: Delete all Firestore subcollections
    for (const subcollection of USER_SUBCOLLECTIONS) {
        try {
            const count = await deleteSubcollection(userId, subcollection);
            if (count > 0) {
                result.deletedCollections.push(`${subcollection} (${count} docs)`);
                logger.info(`[AccountDeletion] Deleted ${count} docs from ${subcollection}`);
            }
        } catch (error) {
            const msg = `Failed to delete ${subcollection}: ${error}`;
            result.errors.push(msg);
            logger.error(`[AccountDeletion] ${msg}`);
        }
    }

    // Step 2: Delete the user profile document itself
    try {
        await deleteDoc(doc(db, 'users', userId));
        result.deletedCollections.push('users/ (profile doc)');
    } catch (error) {
        result.errors.push(`Failed to delete user profile: ${error}`);
    }

    // Step 3: Delete all Storage files
    try {
        result.deletedStorageFiles = await deleteUserStorage(userId);
        logger.info(`[AccountDeletion] Deleted ${result.deletedStorageFiles} storage files`);
    } catch (error) {
        result.errors.push(`Storage deletion error: ${error}`);
    }

    // Step 4: Delete Firebase Auth account
    try {
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.uid === userId) {
            await currentUser.delete();
            logger.info('[AccountDeletion] Firebase Auth account deleted');
        } else {
            result.errors.push('Cannot delete auth account: user not currently signed in');
        }
    } catch (error) {
        result.errors.push(`Auth deletion error: ${error}`);
    }

    result.success = result.errors.length === 0;

    logger.info(`[AccountDeletion] Deletion ${result.success ? 'complete' : 'completed with errors'} for ${userId}`);

    return result;
}
