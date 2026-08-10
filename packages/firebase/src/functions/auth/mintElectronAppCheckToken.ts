import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

/**
 * Mints a custom Firebase App Check token for the Electron client.
 * ReCaptcha Enterprise does not work in Electron because it lacks a web origin.
 * Instead, the Electron client securely authenticates via Firebase Auth,
 * and calls this function to obtain a valid App Check token.
 */
export const mintElectronAppCheckToken = onCall(
  { region: 'us-central1', enforceAppCheck: false, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to mint an App Check token.');
    }

    const appId = request.data?.appId;
    if (typeof appId !== 'string' || !appId) {
      throw new HttpsError('invalid-argument', 'appId is required.');
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
