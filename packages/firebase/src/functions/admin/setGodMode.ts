/**
 * setGodMode - Admin-only Cloud Function
 * 
 * Allows setting the god_mode custom claim on a user account.
 * This function is audited and restricted to users who are themselves admins
 * or have the appropriate permission.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

// Ensure Firebase admin is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

export const setGodMode = onCall(async (request) => {
    // 1. Verify authentication
    if (!request.auth) {
        logger.warn('Unauthenticated attempt to set god_mode');
        throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    // 2. Verify caller is an admin
    // In this system, admins have the `admin` custom claim.
    // As a fallback/bootstrap mechanism, we could allow the founder email
    // but the requirement is to move away from hardcoded emails. We rely on the admin claim.
    if (request.auth.token.admin !== true) {
        logger.warn(`User ${request.auth.uid} attempted to set god_mode without admin privileges`);
        throw new HttpsError('permission-denied', 'Only admins can set god_mode');
    }

    // 3. Validate input
    const { targetUid, enable } = request.data;
    if (!targetUid || typeof enable !== 'boolean') {
        throw new HttpsError('invalid-argument', 'Missing targetUid or enable boolean');
    }

    try {
        // 4. Get the current user to preserve other claims
        const user = await admin.auth().getUser(targetUid);
        const currentClaims = user.customClaims || {};
        
        // 5. Update the claims
        await admin.auth().setCustomUserClaims(targetUid, {
            ...currentClaims,
            god_mode: enable
        });

        logger.info(`Admin ${request.auth.uid} set god_mode to ${enable} for user ${targetUid}`);

        return { 
            success: true, 
            targetUid, 
            god_mode: enable,
            updatedBy: request.auth.uid,
            timestamp: Date.now()
        };
    } catch (error) {
        logger.error('Error setting god_mode claim:', error);
        throw new HttpsError('internal', 'Failed to set custom claims');
    }
});
