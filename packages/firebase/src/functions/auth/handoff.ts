import { onRequest, Request } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as express from 'express';

const db = admin.firestore();

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

    try {
        // 2. Verify the ID token to ensure the request is legitimate
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // 3. Generate a secure random code
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

        // 4. Return tokens and delete the code (one-time use)
        const { idToken, accessToken } = data;
        await docRef.delete();

        res.status(200).json({ idToken, accessToken });
    } catch (err) {
        console.error('Error redeeming handoff code:', err);
        res.status(500).send('Internal Server Error');
    }
});
