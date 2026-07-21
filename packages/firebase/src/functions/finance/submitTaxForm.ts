import { onRequest, Request } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as express from 'express';

/**
 * Public, unauthenticated ingress for a payment collaborator to submit their
 * W-9/W-8BEN via a single-use token link minted by requestTaxFormUpload.
 * Storage rules deny all client writes to tax_docs/**, so this Admin-SDK
 * write is the only path bytes can reach there — gated entirely by the
 * token, not by Firebase Auth (the collaborator has no indii account).
 */

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 10;
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // matches storage.rules isUnderSizeLimit(20)
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

export interface SubmitTaxFormInput {
    token: unknown;
    fileBase64: unknown;
    fileName: unknown;
    contentType: unknown;
}

export interface SubmitTaxFormResult {
    status: number;
    body: { success: true } | string;
}

function getClientIp(req: Request): string {
    const rawIp = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const firstIp = Array.isArray(rawIp) ? rawIp[0] : rawIp.split(',')[0].trim();
    return firstIp || 'unknown';
}

async function isRateLimited(ip: string, action: string): Promise<boolean> {
    const db = admin.firestore();
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
        return false;
    }
}

export async function processSubmitTaxForm(input: SubmitTaxFormInput): Promise<SubmitTaxFormResult> {
    const { token, fileBase64, fileName, contentType } = input;

    if (typeof token !== 'string' || !/^[a-fA-F0-9]{64}$/.test(token)) {
        return { status: 400, body: 'Invalid or missing link token.' };
    }
    if (typeof fileBase64 !== 'string' || fileBase64.length === 0) {
        return { status: 400, body: 'Missing file data.' };
    }
    if (typeof fileName !== 'string' || fileName.length === 0) {
        return { status: 400, body: 'Missing file name.' };
    }
    if (typeof contentType !== 'string' || !ALLOWED_MIME_TYPES.includes(contentType)) {
        return { status: 400, body: 'Unsupported file type. Upload a PDF, PNG, or JPEG.' };
    }

    let buffer: Buffer;
    try {
        buffer = Buffer.from(fileBase64, 'base64');
    } catch {
        return { status: 400, body: 'File data is not valid base64.' };
    }
    if (buffer.length === 0 || buffer.length > MAX_SIZE_BYTES) {
        return { status: 400, body: `File too large. Max ${MAX_SIZE_BYTES / 1024 / 1024}MB.` };
    }

    const db = admin.firestore();
    const requestRef = db.collection('taxFormRequests').doc(token);

    const consumeResult = await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
            return { status: 404 as const, message: 'Invalid or expired link.' };
        }
        const data = snap.data()!;
        if (data.consumedAt) {
            return { status: 409 as const, message: 'This link has already been used.' };
        }
        const expiresAt = data.expiresAt.toDate();
        if (expiresAt < new Date()) {
            tx.delete(requestRef);
            return { status: 404 as const, message: 'This link has expired.' };
        }
        tx.update(requestRef, { consumedAt: admin.firestore.FieldValue.serverTimestamp() });
        return { status: 200 as const, artistUid: data.artistUid as string, collaboratorId: data.collaboratorId as string };
    });

    if (consumeResult.status !== 200) {
        return { status: consumeResult.status, body: consumeResult.message };
    }

    const { artistUid, collaboratorId } = consumeResult;
    const collaboratorRef = db.doc(`users/${artistUid}/tax_collaborators/${collaboratorId}`);
    const collaboratorSnap = await collaboratorRef.get();
    if (!collaboratorSnap.exists) {
        return { status: 404, body: 'Collaborator record no longer exists.' };
    }

    const storagePath = `tax_docs/${artistUid}/${collaboratorId}/${Date.now()}-${fileName}`;
    await admin.storage().bucket().file(storagePath).save(buffer, { contentType });

    await collaboratorRef.update({
        status: 'on_file',
        storagePath,
        fileName,
        sizeBytes: buffer.length,
        uploadedAt: Date.now(),
    });

    return { status: 200, body: { success: true } };
}

export const submitTaxForm = onRequest({ cors: true }, async (req: Request, res: express.Response) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const ip = getClientIp(req);
    if (await isRateLimited(ip, 'submit_tax_form')) {
        res.status(429).send('Too Many Requests. Please wait a minute and try again.');
        return;
    }

    try {
        const result = await processSubmitTaxForm(req.body || {});
        if (typeof result.body === 'string') {
            res.status(result.status).send(result.body);
        } else {
            res.status(result.status).json(result.body);
        }
    } catch (err) {
        console.error('[submitTaxForm] Error:', err);
        res.status(500).send('Internal Server Error');
    }
});
