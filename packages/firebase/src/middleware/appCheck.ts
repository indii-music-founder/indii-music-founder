import * as functionsV1 from 'firebase-functions/v1';
import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import * as express from 'express';
import * as admin from 'firebase-admin';

// Check if App Check is enabled in the current environment (disabled during unit tests)
export const ENFORCE_APP_CHECK =
    process.env.VITEST === undefined &&
    process.env.SKIP_APP_CHECK !== 'true' &&
    process.env.ENFORCE_APP_CHECK !== 'false';

/**
 * Validate App Check for Gen 1 Callable functions.
 */
export function validateAppCheckV1(context: functionsV1.https.CallableContext): void {
    if (!ENFORCE_APP_CHECK) return;

    if (!context.app) {
        throw new functionsV1.https.HttpsError(
            'failed-precondition',
            'Unauthorized: Missing App Check token.'
        );
    }
}

/**
 * Returns the authenticated UID only after Firebase's signed email-verification
 * claim has been checked. Profile fields and client-provided flags are never
 * accepted as substitutes for this claim.
 */
export function requireVerifiedEmailV1(context: functionsV1.https.CallableContext): string {
    const auth = context.auth;
    if (!auth?.uid) {
        throw new functionsV1.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    if (auth.token.email_verified !== true) {
        throw new functionsV1.https.HttpsError(
            'failed-precondition',
            'Verify your email before using creative generation.'
        );
    }
    return auth.uid;
}

/**
 * Validate App Check for Gen 2 Callable functions.
 */
export function validateAppCheckV2(request: CallableRequest): void {
    if (!ENFORCE_APP_CHECK) return;

    if (!request.app) {
        throw new HttpsError(
            'failed-precondition',
            'Unauthorized: Missing App Check token.'
        );
    }
}

/**
 * Validate App Check for HTTP onRequest functions.
 * Returns true if validation passes (or is bypassed), false if unauthorized.
 * Automatically sends the 401 response if verification fails.
 */
export async function validateAppCheckHttp(req: express.Request, res: express.Response): Promise<boolean> {
    if (!ENFORCE_APP_CHECK) return true;

    const appCheckToken = typeof req.header === 'function'
        ? req.header('x-firebase-appcheck')
        : typeof req.get === 'function'
            ? req.get('x-firebase-appcheck')
            : req.headers['x-firebase-appcheck'];

    if (!appCheckToken) {
        res.status(401).send('Unauthorized: Missing App Check token');
        return false;
    }

    try {
        const token = Array.isArray(appCheckToken) ? appCheckToken[0] : appCheckToken;
        await admin.appCheck().verifyToken(token);
        return true;
    } catch {
        res.status(401).send('Unauthorized: Invalid App Check token');
        return false;
    }
}
