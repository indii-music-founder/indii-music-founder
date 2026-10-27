import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { randomUUID } from 'node:crypto';
import { arcjetKey } from '../../config/secrets';
import { protectAuthenticatedApiRequest } from '../security/arcjet';

// The Electron renderer uses this registered Firebase web app for its custom
// App Check provider. Never trust an app ID supplied by a caller to the mint.
const ELECTRON_FIREBASE_APP_ID = '1:148015878263:web:febc76c0bd56f28cdbb672';

/**
 * Mints a custom Firebase App Check token for the Electron client.
 * ReCaptcha Enterprise does not work in Electron because it lacks a web origin.
 * Instead, the Electron client securely authenticates via Firebase Auth,
 * and calls this function to obtain a valid App Check token.
 */
export const mintElectronAppCheckToken = onCall(
  { region: 'us-central1', enforceAppCheck: false, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1, secrets: [arcjetKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid || request.auth?.token.email_verified !== true || request.auth.token.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('unauthenticated', 'A verified signed-in user is required to mint an App Check token.');
    }

    const appId = request.data?.appId;
    if (appId !== ELECTRON_FIREBASE_APP_ID) {
      throw new HttpsError('permission-denied', 'This Firebase app is not authorized for Electron App Check.');
    }
    if (!request.rawRequest) {
      throw new HttpsError('unavailable', 'Request protection is temporarily unavailable.');
    }
    const protection = await protectAuthenticatedApiRequest(request.rawRequest, {
      userId: uid,
      policy: 'verified-free',
      operationId: `mint-electron-app-check:${randomUUID()}`,
    });
    if (!protection.allowed) {
      throw new HttpsError(
        protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
        protection.message,
      );
    }

    try {
      const appCheckToken = await admin.appCheck().createToken(appId);
      return {
        token: appCheckToken.token,
        // Calculate absolute expiration time in milliseconds
        expireTimeMillis: Date.now() + appCheckToken.ttlMillis
      };
    } catch (err) {
      console.error('Error minting custom App Check token:', err);
      throw new HttpsError('internal', 'Failed to mint App Check token.');
    }
  }
);
