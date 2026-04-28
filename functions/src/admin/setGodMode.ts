/**
 * setGodMode - Admin-Only Cloud Function
 *
 * Enables or disables god_mode custom claim for a user.
 * Only callable by authorized admins (hardcoded UID list).
 * All invocations are audited to god_mode_audit collection.
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

// Hardcoded list of admin UIDs authorized to set god_mode
const AUTHORIZED_ADMINS = [
  '9NYyLqEcKQQcr0HSfEkmfuSX9Xx1', // William Roberts
];

interface SetGodModeRequest {
  uid: string;
  enabled: boolean;
}

interface SetGodModeResponse {
  ok: boolean;
  uid: string;
  enabled: boolean;
}

export const setGodMode = functions
  .region('us-west1')
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onCall(
    async (
      data: unknown,
      context: functions.https.CallableContext
    ): Promise<SetGodModeResponse> => {
      // 1. Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated.'
        );
      }

      const callerId = context.auth.uid;

      // 2. Verify admin authorization
      if (!AUTHORIZED_ADMINS.includes(callerId)) {
        console.warn(
          `[setGodMode] Unauthorized access attempt by ${callerId}`
        );
        throw new functions.https.HttpsError(
          'permission-denied',
          'Access denied: Admin privileges required.'
        );
      }

      // 3. Validate input
      if (typeof data !== 'object' || data === null) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Request body must be an object.'
        );
      }

      const req = data as Record<string, unknown>;
      const targetUid = req.uid;
      const enabled = req.enabled;

      if (typeof targetUid !== 'string' || !targetUid) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Field "uid" is required and must be a non-empty string.'
        );
      }

      if (typeof enabled !== 'boolean') {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Field "enabled" is required and must be a boolean.'
        );
      }

      try {
        // 4. Get existing custom claims
        const existingUser = await admin.auth().getUser(targetUid);
        const existingClaims = existingUser.customClaims || {};

        // 5. Update custom claims
        const updatedClaims = {
          ...existingClaims,
          god_mode: enabled,
        };

        await admin.auth().setCustomUserClaims(targetUid, updatedClaims);

        // 6. Audit log to Firestore
        await admin
          .firestore()
          .collection('god_mode_audit')
          .add({
            caller: callerId,
            target: targetUid,
            enabled: enabled,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

        console.log(
          `[setGodMode] ${callerId} set god_mode=${enabled} for ${targetUid}`
        );

        return {
          ok: true,
          uid: targetUid,
          enabled: enabled,
        };
      } catch (error: unknown) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        console.error(`[setGodMode] Error:`, error);
        throw new functions.https.HttpsError('internal', `Failed to set god_mode: ${errorMsg}`);
      }
    }
  );
