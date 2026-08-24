import { onRequest, Request } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as express from 'express';

const getDb = () => admin.firestore();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS_PER_WINDOW = 10; // max 10 requests per minute

interface StoredHandoff {
    userId: string;
    idToken: string;
    accessToken: string | null;
    expiresAt: Date;
}

export type HandoffRedemptionResult =
    | { status: 200; customToken: string; idToken: string; accessToken: string | null }
    | { status: 404; message: 'Invalid or expired code' };

export interface HandoffRedemptionDependencies {
    load: () => Promise<StoredHandoff | null>;
    expire: () => Promise<void>;
    mintCustomToken: (userId: string) => Promise<string>;
    consume: (userId: string, now: Date) => Promise<boolean>;
    now?: () => Date;
}

/**
 * Mint before consuming the one-time record. A production IAM outage must not
 * destroy a valid QR code before Firebase can create the phone's custom token.
 * The final atomic consume remains the single winner for concurrent requests;
 * tokens minted by losing requests are never returned to a client.
 */
export async function redeemStoredHandoff(
    dependencies: HandoffRedemptionDependencies,
): Promise<HandoffRedemptionResult> {
    const now = dependencies.now?.() ?? new Date();
    const handoff = await dependencies.load();

    if (!handoff) {
        return { status: 404, message: 'Invalid or expired code' };
    }

    if (handoff.expiresAt < now) {
        await dependencies.expire();
        return { status: 404, message: 'Invalid or expired code' };
    }

    const customToken = await dependencies.mintCustomToken(handoff.userId);
    const consumeTime = dependencies.now?.() ?? new Date();
    const consumed = await dependencies.consume(handoff.userId, consumeTime);
    if (!consumed) {
        return { status: 404, message: 'Invalid or expired code' };
    }

    return {
        status: 200,
        customToken,
        idToken: handoff.idToken,
        accessToken: handoff.accessToken,
    };
}

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
    const db = getDb();
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
        const db = getDb();
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
        const db = getDb();
        const docRef = db.collection('auth_handoffs').doc(code);

        const result = await redeemStoredHandoff({
            load: async () => {
                const doc = await docRef.get();
                const data = doc.data();
                if (!doc.exists || !data) return null;
                return {
                    userId: data.userId,
                    idToken: data.idToken,
                    accessToken: data.accessToken ?? null,
                    expiresAt: data.expiresAt.toDate(),
                };
            },
            expire: async () => {
                await docRef.delete();
            },
            mintCustomToken: (userId) => admin.auth().createCustomToken(userId),
            consume: async (expectedUserId, now) => db.runTransaction(async (transaction) => {
                const current = await transaction.get(docRef);
                const data = current.data();
                if (!current.exists || !data || data.userId !== expectedUserId) return false;

                if (data.expiresAt.toDate() < now) {
                    transaction.delete(docRef);
                    return false;
                }

                transaction.delete(docRef);
                return true;
            }),
        });

        if (result.status !== 200) {
            res.status(result.status).send(result.message);
            return;
        }

        res.status(200).json({
            idToken: result.idToken,
            accessToken: result.accessToken,
            customToken: result.customToken,
        });
    } catch (err) {
        console.error('Error redeeming handoff code:', err);
        res.status(500).send('Internal Server Error');
    }
});
