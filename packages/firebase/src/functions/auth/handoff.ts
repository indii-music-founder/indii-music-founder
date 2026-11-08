import { onRequest, Request } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as express from 'express';
import { arcjetKey } from '../../config/secrets';
import { protectAnonymousSignupRequest } from '../security/arcjet';

const getDb = () => admin.firestore();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS_PER_WINDOW = 10; // max 10 requests per minute

export interface StoredHandoff {
    userId: string;
    codeChallenge?: string;
    codeChallengeMethod?: 'S256' | 'plain';
    expiresAt: Date;
}

export type HandoffRedemptionResult =
    | { status: 200; customToken: string }
    | { status: 400; message: 'Invalid code verifier' }
    | { status: 404; message: 'Invalid or expired code' };

export interface HandoffRedemptionDependencies {
    load: () => Promise<StoredHandoff | null>;
    expire: () => Promise<void>;
    mintCustomToken: (userId: string) => Promise<string>;
    consume: (userId: string, now: Date) => Promise<boolean>;
    now?: () => Date;
}

/**
 * Validates a PKCE code_verifier against a stored code_challenge using timing-safe comparison.
 * Supports both base64url and hex digests for S256.
 */
export function verifyPkce(
    codeVerifier: string,
    codeChallenge: string,
    method: 'S256' | 'plain' = 'S256',
): boolean {
    if (!codeVerifier || !codeChallenge) return false;
    if (method === 'plain') {
        if (codeVerifier.length !== codeChallenge.length) return false;
        return crypto.timingSafeEqual(Buffer.from(codeVerifier), Buffer.from(codeChallenge));
    }

    const hashHex = crypto.createHash('sha256').update(codeVerifier).digest('hex');
    const hashBase64Url = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    if (hashHex.length === codeChallenge.length &&
        crypto.timingSafeEqual(Buffer.from(hashHex), Buffer.from(codeChallenge))) {
        return true;
    }

    if (hashBase64Url.length === codeChallenge.length &&
        crypto.timingSafeEqual(Buffer.from(hashBase64Url), Buffer.from(codeChallenge))) {
        return true;
    }

    return false;
}

/**
 * Mint strictly AFTER consuming the one-time record.
 * A production IAM outage or expired/used code must never invoke IAM signBlob
 * before the atomic transaction confirms the redemption was claimed.
 */
export async function redeemStoredHandoff(
    dependencies: HandoffRedemptionDependencies,
    options?: { codeVerifier?: string },
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

    // Verify PKCE if a codeChallenge was registered
    if (handoff.codeChallenge) {
        if (!options?.codeVerifier || !verifyPkce(options.codeVerifier, handoff.codeChallenge, handoff.codeChallengeMethod || 'S256')) {
            return { status: 400, message: 'Invalid code verifier' };
        }
    }

    const consumeTime = dependencies.now?.() ?? new Date();
    const consumed = await dependencies.consume(handoff.userId, consumeTime);
    if (!consumed) {
        return { status: 404, message: 'Invalid or expired code' };
    }

    // Mint custom token strictly after atomic consume succeeds
    const customToken = await dependencies.mintCustomToken(handoff.userId);

    return {
        status: 200,
        customToken,
    };
}

/**
 * Clean and extract IP from request, avoiding spoofable client-supplied x-forwarded-for headers.
 */
export function getClientIp(req: Request): string {
    if (req.ip && req.ip !== '127.0.0.1' && req.ip !== '::1' && req.ip !== 'unknown') {
        return req.ip;
    }
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        const parts = (Array.isArray(xForwardedFor) ? xForwardedFor.join(',') : xForwardedFor)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        if (parts.length > 0) {
            // When behind Cloud Load Balancers, the rightmost entry was appended by the edge proxy
            return parts[parts.length - 1] || 'unknown';
        }
    }
    return req.ip || 'unknown';
}

/**
 * Firestore-based IP Rate Limiting middleware helper.
 * Fails closed on database transaction errors or contention to prevent brute-force bypass.
 */
export async function isRateLimited(ip: string, action: string, dbOverride?: admin.firestore.Firestore): Promise<boolean> {
    const db = dbOverride || getDb();
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
        // Security requirement: fail closed on database error or transaction contention
        return true;
    }
}

/**
 * Creates a short-lived handoff code for cross-device or cross-origin authentication.
 * Used by the login bridge (landing page) to hand off credentials to the desktop app.
 * 
 * POST /createHandoffCode
 * Body: { idToken: string, codeChallenge?: string, codeChallengeMethod?: 'S256' | 'plain' }
 */
export const createHandoffCode = onRequest({ cors: true, secrets: [arcjetKey] }, async (req: Request, res: express.Response) => {
    // 1. Validate method
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const protection = await protectAnonymousSignupRequest(
        req as never,
        'auth-handoff-create',
        'allow-low-risk-read'
    );
    if (!protection.allowed) {
        if (protection.retryAfterSeconds && typeof res.setHeader === 'function') {
            res.setHeader('Retry-After', String(protection.retryAfterSeconds));
        }
        res.status(protection.status).send(protection.message);
        return;
    }

    const { idToken, codeChallenge, codeChallengeMethod } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
        res.status(400).send('Missing idToken');
        return;
    }

    if (codeChallenge && typeof codeChallenge !== 'string') {
        res.status(400).send('Invalid codeChallenge format');
        return;
    }

    const ip = getClientIp(req);
    if (await isRateLimited(ip, 'create_handoff')) {
        res.status(429).send('Too Many Requests. Please wait a minute and try again.');
        return;
    }

    try {
        const db = getDb();
        // 2. Verify the ID token to ensure the request is legitimate and extract caller UID
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // 3. Generate a secure random code (64 hex characters)
        const code = crypto.randomBytes(32).toString('hex');

        // 4. Store in Firestore with a short TTL (5 minutes) - NEVER store raw idToken or accessToken!
        await db.collection('auth_handoffs').doc(code).set({
            userId,
            ...(codeChallenge ? {
                codeChallenge,
                codeChallengeMethod: codeChallengeMethod === 'plain' ? 'plain' : 'S256',
            } : {}),
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
 * Redeems a handoff code for a newly-minted custom token.
 * Used by the companion/desktop app to retrieve tokens passed from the login bridge.
 * 
 * POST /redeemHandoffCode
 * Body: { code: string, codeVerifier?: string }
 */
export const redeemHandoffCode = onRequest({ cors: true, secrets: [arcjetKey] }, async (req: Request, res: express.Response) => {
    // 1. Validate method
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const protection = await protectAnonymousSignupRequest(
        req as never,
        'auth-handoff-redeem',
        'allow-low-risk-read'
    );
    if (!protection.allowed) {
        if (protection.retryAfterSeconds && typeof res.setHeader === 'function') {
            res.setHeader('Retry-After', String(protection.retryAfterSeconds));
        }
        res.status(protection.status).send(protection.message);
        return;
    }

    const { code, codeVerifier } = req.body || {};
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

        const result = await redeemStoredHandoff(
            {
                load: async () => {
                    const doc = await docRef.get();
                    const data = doc.data();
                    if (!doc.exists || !data) return null;
                    return {
                        userId: data.userId,
                        codeChallenge: data.codeChallenge,
                        codeChallengeMethod: data.codeChallengeMethod,
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
            },
            { codeVerifier },
        );

        if (result.status !== 200) {
            res.status(result.status).send(result.message);
            return;
        }

        res.status(200).json({
            customToken: result.customToken,
        });
    } catch (err) {
        console.error('Error redeeming handoff code:', err);
        res.status(500).send('Internal Server Error');
    }
});
