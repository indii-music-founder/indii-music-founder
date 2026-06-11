import { onRequest, Request } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as express from 'express';

const db = admin.firestore();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS_PER_WINDOW = 10; // max 10 requests per minute

/**
 * Clean and extract IP from request
 */
function getClientIp(req: Request): string {
    const rawIp = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const firstIp = Array.isArray(rawIp) ? rawIp[0] : rawIp.split(',')[0].trim();
    return firstIp || 'unknown';
}

/**
 * Firestore-based IP Rate Limiting middleware helper
 */
async function isRateLimited(ip: string, action: string): Promise<boolean> {
    const cleanIp = ip.replace(/[^a-zA-Z0-9]/g, '_');
    const docRef = db.collection('rate_limits').doc(`${action}_${cleanIp}`);
    
    try {
        return await db.runTransaction(async (tx) => {
            const snap = await tx.get(docRef);
            const now = Date.now();
            
            if (snap.exists) {
                const data = snap.data();
                if (data) {
                    const { windowStart, count } = data;
                    if (now - windowStart < RATE_LIMIT_WINDOW_MS) {
                        if (count >= MAX_ATTEMPTS_PER_WINDOW) {
                            return true;
                        }
                        tx.update(docRef, { count: count + 1 });
                    } else {
                        tx.set(docRef, { windowStart: now, count: 1 });
                    }
                }
            } else {
                tx.set(docRef, { windowStart: now, count: 1 });
            }
            return false;
        });
    } catch (err) {
        console.error(`[RateLimit] Transaction error for ${ip} / ${action}:`, err);
        // Fallback to allow request in case of database issues
        return false;
    }
}

/**
 * Creates a short-lived handoff code for cross-device or cross-origin authentication.
 * Used by the login bridge (landing page) to hand off credentials to the desktop app.
 * 
 * POST /createHandoffCode
 * Body: { idToken: string, accessToken?: string }
 */
export const createHandoffCode = onRequest({ cors: true }, async (req: Request, res: express.Response) => {
    // 1. Validate method
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { idToken, accessToken } = req.body;
    if (!idToken) {
        res.status(400).send('Missing idToken');
        return;
    }

    const ip = getClientIp(req);
    if (await isRateLimited(ip, 'create_handoff')) {
        res.status(429).send('Too Many Requests. Please wait a minute and try again.');
        return;
    }

    try {
        // 2. Verify the ID token to ensure the request is legitimate
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // 3. Generate a secure random code (64 hex characters)
        const code = crypto.randomBytes(32).toString('hex');

        // 4. Store in Firestore with a short TTL (5 minutes)
        await db.collection('auth_handoffs').doc(code).set({
            userId,
            idToken,
            accessToken: accessToken || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        });

        res.status(200).json({ code });
    } catch (err) {
        console.error('Error creating handoff code:', err);
        res.status(500).send('Internal Server Error');
    }
});

/**
 * Redeems a handoff code for the original authentication tokens.
 * Used by the desktop app to retrieve tokens passed from the login bridge.
 * 
 * POST /redeemHandoffCode
 * Body: { code: string }
 */
export const redeemHandoffCode = onRequest({ cors: true }, async (req: Request, res: express.Response) => {
    // 1. Validate method
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { code } = req.body;
    if (!code) {
        res.status(400).send('Missing code');
        return;
    }

    // Security check: Validate 64-hex format for the handoff code to prevent key traversal/SQLi-like attempts
    if (typeof code !== 'string' || !/^[a-fA-F0-9]{64}$/.test(code)) {
        res.status(400).send('Invalid code format');
        return;
    }

    const ip = getClientIp(req);
    if (await isRateLimited(ip, 'redeem_handoff')) {
        res.status(429).send('Too Many Requests. Please wait a minute and try again.');
        return;
    }

    try {
        // 2. Lookup the code
        const docRef = db.collection('auth_handoffs').doc(code);
        const doc = await docRef.get();

        if (!doc.exists) {
            res.status(404).send('Invalid or expired code');
            return;
        }

        const data = doc.data();
        if (!data) {
            res.status(404).send('Invalid or expired code');
            return;
        }

        // 3. Check expiration
        const expiresAt = data.expiresAt.toDate();
        if (expiresAt < new Date()) {
            await docRef.delete();
            res.status(404).send('Code expired');
            return;
        }

        // 4. Return tokens, custom token, and delete the code (one-time use)
        const { idToken, accessToken, userId } = data;
        const customToken = await admin.auth().createCustomToken(userId);
        await docRef.delete();

        res.status(200).json({ idToken, accessToken, customToken });
    } catch (err) {
        console.error('Error redeeming handoff code:', err);
        res.status(500).send('Internal Server Error');
    }
});
