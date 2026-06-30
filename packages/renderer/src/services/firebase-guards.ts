/**
 * Firebase Service Guards
 * Prevents undefined errors from Firebase services by adding safety checks
 * before using functions, db, auth, storage, etc.
 *
 * Usage:
 * const fn = getFirebaseFunction('generateImageV3');
 * if (!fn) { toast.error('Service unavailable'); return; }
 * const result = await fn(payload);
 */

import { functions as fbFunctions, db as fbDb, auth as fbAuth, storage as fbStorage } from '@/services/firebase';
import { logger } from '@/utils/logger';

/**
 * Get Firebase Functions client with safety check.
 * Returns null if functions service isn't initialized.
 */
export function getFirebaseFunction(name?: string) {
    if (!fbFunctions) {
        logger.error('[Firebase Guard] Functions service not initialized', { name });
        return null;
    }
    return fbFunctions;
}

/**
 * Get Firestore database with safety check.
 */
export function getFirebaseDB() {
    if (!fbDb) {
        logger.error('[Firebase Guard] Firestore database not initialized');
        return null;
    }
    return fbDb;
}

/**
 * Get Firebase Auth with safety check.
 */
export function getFirebaseAuth() {
    if (!fbAuth) {
        logger.error('[Firebase Guard] Auth service not initialized');
        return null;
    }
    return fbAuth;
}

/**
 * Get Firebase Storage with safety check.
 */
export function getFirebaseStorage() {
    if (!fbStorage) {
        logger.error('[Firebase Guard] Storage service not initialized');
        return null;
    }
    return fbStorage;
}

/**
 * Check if current user is authenticated.
 * Returns null if not authenticated.
 */
export function getCurrentUserId(): string | null {
    const auth = getFirebaseAuth();
    if (!auth) return null;
    const uid = auth.currentUser?.uid;
    if (!uid) {
        logger.warn('[Firebase Guard] User not authenticated');
        return null;
    }
    return uid;
}

/**
 * Higher-order function to wrap Firebase calls with safety check.
 *
 * Usage:
 * const result = await withFirebaseGuard(() => httpsCallable(functions, 'fn')(payload));
 */
export async function withFirebaseGuard<T>(
    fn: () => Promise<T>,
    label: string = 'Firebase operation'
): Promise<T | null> {
    try {
        return await fn();
    } catch (error: unknown) {
        logger.error(`[Firebase Guard] ${label} failed:`, error);
        return null;
    }
}
