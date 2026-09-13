import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { metaAppSecret, metaWebhookVerifyToken } from '../config/secrets';
import { classifyInstagramMessagingEvent, normalizeInstagramCommerceChange } from './instagramWebhookPolicy';

function validSignature(rawBody: Buffer, supplied: string | undefined, secret: string): boolean {
    if (!supplied?.startsWith('sha256=')) return false;
    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const left = Buffer.from(expected);
    const right = Buffer.from(supplied);
    return left.length === right.length && timingSafeEqual(left, right);
}

async function createOnce(ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>): Promise<boolean> {
    try {
        await ref.create(data);
        return true;
    } catch (error) {
        const code = (error as { code?: number | string }).code;
        if (code === 6 || code === 'already-exists') return false;
        throw error;
    }
}

export const instagramWebhook = onRequest(
    { secrets: [metaAppSecret, metaWebhookVerifyToken], timeoutSeconds: 30, memory: '512MiB' },
    async (request, response) => {
        if (request.method === 'GET') {
            const verified = request.query['hub.mode'] === 'subscribe'
                && request.query['hub.verify_token'] === metaWebhookVerifyToken.value();
            if (!verified) { response.sendStatus(403); return; }
            response.status(200).send(String(request.query['hub.challenge'] ?? '')); return;
        }
        if (request.method !== 'POST' || !validSignature(request.rawBody, request.header('x-hub-signature-256'), metaAppSecret.value())) {
            response.sendStatus(403); return;
        }

        const db = admin.firestore();
        const body = request.body as { entry?: Array<{ id?: string; messaging?: Record<string, unknown>[]; changes?: Record<string, unknown>[] }> };
        for (const entry of body.entry ?? []) {
            if (!entry.id) continue;
            const registry = await db.collection('socialChannelRegistry').doc(`instagram_${entry.id}`).get();
            if (!registry.exists) continue;
            const ownerId = registry.get('ownerId');
            if (typeof ownerId !== 'string') continue;

            for (const rawEvent of entry.messaging ?? []) {
                const event = classifyInstagramMessagingEvent(rawEvent);
                const sourceId = event.eventId ?? createHash('sha256').update(JSON.stringify(rawEvent)).digest('hex');
                const eventId = createHash('sha256').update(`${entry.id}:${sourceId}`).digest('hex');
                const isNew = await createOnce(db.collection('socialWebhookEvents').doc(eventId), {
                    ownerId, platform: 'instagram', sourceId, kind: event.kind,
                    replyEligible: event.replyEligible, receivedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                if (!isNew) continue;
                if (!event.replyEligible || !event.senderId) continue;
                await db.collection('socialInbox').doc(eventId).create({
                    ownerId, platform: 'instagram', accountId: entry.id,
                    senderId: event.senderId, sourceId, sourceType: event.kind,
                    text: event.text ?? '', responseStatus: 'pending',
                    receivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
                });
            }

            for (const change of entry.changes ?? []) {
                const signal = normalizeInstagramCommerceChange(change);
                if (!signal) continue;
                const signalSource = signal.orderId ?? createHash('sha256').update(JSON.stringify(change)).digest('hex');
                const signalEventId = createHash('sha256').update(`${entry.id}:commerce:${signalSource}`).digest('hex');
                const isNew = await createOnce(db.collection('socialWebhookEvents').doc(signalEventId), {
                    ownerId, platform: 'instagram', sourceId: signalSource, kind: signal.kind,
                    replyEligible: false, receivedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                if (!isNew) continue;
                const leadId = createHash('sha256').update(`instagram:${signal.customerId}`).digest('hex');
                const followUpDelay = signal.kind === 'purchase' ? 60 : 15;
                await db.collection('users').doc(ownerId).collection('crmLeads').doc(leadId).set({
                    ownerId, platform: 'instagram', platformCustomerId: signal.customerId,
                    latestSignal: signal.kind, orderId: signal.orderId ?? null,
                    totalSpend: admin.firestore.FieldValue.increment(signal.amount ?? 0),
                    currency: signal.currency ?? null, followUpStatus: 'pending_review',
                    automatedWelcomeDmEnabled: false,
                    nextFollowUpAt: admin.firestore.Timestamp.fromMillis(Date.now() + followUpDelay * 60_000),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
        }
        response.sendStatus(200);
    },
);
