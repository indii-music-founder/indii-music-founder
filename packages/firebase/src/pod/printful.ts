import { randomUUID } from 'node:crypto';
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { arcjetKey, printfulApiKey } from '../config/secrets';
import { validateAppCheckV2 } from '../middleware/appCheck';
import { protectAuthenticatedApiRequest } from '../functions/security/arcjet';
import { printfulRequest } from './printfulApi';
import { assertSafeApiPathSegment, assertSafeExternalHttpsUrl } from '../lib/safeExternalUrl';
import { getFirestore } from 'firebase-admin/firestore';

async function requireAuth(req: CallableRequest<unknown>, operation = 'pod'): Promise<string> {
    validateAppCheckV2(req);
    if (!req.auth || !req.auth.uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    if (req.auth.token?.firebase?.sign_in_provider === 'anonymous') {
        throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
    }
    if (req.auth.token?.email_verified !== true) {
        throw new HttpsError('permission-denied', 'Verified email is required.');
    }
    if (req.rawRequest) {
        const protection = await protectAuthenticatedApiRequest(req.rawRequest as never, {
            userId: req.auth.uid,
            policy: 'verified-free',
            operationId: `pod:${operation}:${randomUUID()}`,
        });
        if (!protection.allowed) {
            throw new HttpsError(
                protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                protection.message,
            );
        }
    }
    return req.auth.uid;
}

export const pod_printfulGetProducts = onCall({ secrets: [printfulApiKey, arcjetKey], enforceAppCheck: true }, async (req) => {
    await requireAuth(req, 'get-products');
    return await printfulRequest<unknown[]>('/store/products');
});

export const pod_printfulGetProduct = onCall({ secrets: [printfulApiKey, arcjetKey], enforceAppCheck: true }, async (req) => {
    await requireAuth(req, 'get-product');
    const productId = assertSafeApiPathSegment(req.data?.productId, 'productId');
    return await printfulRequest<unknown>(`/store/products/${encodeURIComponent(productId)}`);
});

export const pod_printfulCalculatePrice = onCall({ secrets: [printfulApiKey, arcjetKey], enforceAppCheck: true }, async (req) => {
    await requireAuth(req, 'calculate-price');
    const items = Array.isArray(req.data?.items) ? req.data.items : [];
    if (items.length === 0) {
        throw new HttpsError('invalid-argument', 'At least one item is required.');
    }
    return await printfulRequest<unknown>('/orders/estimate-costs', {
        method: 'POST',
        body: JSON.stringify({
            items: items.map((item: Record<string, unknown>) => ({
                sync_variant_id: item.variantId,
                quantity: item.quantity,
                files: [{ url: assertSafeExternalHttpsUrl(item.designUrl, 'designUrl') }]
            }))
        })
    });
});

export const pod_printfulGetShippingRates = onCall({ secrets: [printfulApiKey, arcjetKey], enforceAppCheck: true }, async (req) => {
    await requireAuth(req, 'get-shipping-rates');
    return await printfulRequest<unknown[]>('/shipping/rates', {
        method: 'POST',
        body: JSON.stringify({
            recipient: {
                address1: req.data.address.address1,
                city: req.data.address.city,
                state_code: req.data.address.stateCode,
                country_code: req.data.address.countryCode,
                zip: req.data.address.postalCode
            },
            items: req.data.items.map((item: Record<string, unknown>) => ({
                sync_variant_id: item.variantId,
                quantity: item.quantity
            }))
        })
    });
});

export const pod_printfulCreateOrder = onCall({ secrets: [printfulApiKey, arcjetKey], enforceAppCheck: true }, async (req) => {
    const uid = await requireAuth(req, 'create-order');
    const address = req.data?.address as Record<string, unknown> | undefined;
    const items = Array.isArray(req.data?.items) ? (req.data.items as Array<Record<string, unknown>>) : [];
    if (!address || typeof address.name !== 'string' || !address.name.trim() || items.length === 0 || items.length > 50) {
        throw new HttpsError('invalid-argument', 'Valid recipient address and 1-50 items are required.');
    }

    // Call printful to create the order
    const result = await printfulRequest<unknown>('/orders', {
        method: 'POST',
        body: JSON.stringify({
            // Containment: orders must stay Printful DRAFTS. A confirmed order
            // charges indii's Printful account real money, and there is no
            // paid-checkout binding on this path yet (tracked in
            // OPEN_ISSUES_V3). Never set confirm:true without that gate.
            confirm: false,
            recipient: {
                name: address.name,
                company: address.company,
                address1: address.address1,
                address2: address.address2,
                city: address.city,
                state_code: address.stateCode,
                country_code: address.countryCode,
                zip: address.postalCode,
                phone: address.phone,
                email: address.email
            },
            items: items.map((item: Record<string, unknown>) => ({
                sync_variant_id: item.variantId,
                quantity: item.quantity,
                files: [{
                    url: assertSafeExternalHttpsUrl(item.designUrl, 'designUrl'),
                    position: item.printArea
                }]
            })),
            shipping: req.data.shippingMethod
        })
    });

    const orderId = (result as any).id;
    if (!orderId) {
        throw new HttpsError('internal', 'Failed to retrieve order ID from Printful');
    }

    // Save the ownership record in Firestore so Get/Cancel can verify ownership
    await getFirestore().collection('users').doc(uid).collection('pod_orders').doc(String(orderId)).set({
        createdAt: new Date().toISOString(),
        orderId: String(orderId),
        status: 'created'
    });

    return result;
});

async function verifyOrderOwnership(uid: string, orderId: string) {
    const doc = await getFirestore().collection('users').doc(uid).collection('pod_orders').doc(String(orderId)).get();
    if (!doc.exists) {
        throw new HttpsError('permission-denied', 'You do not have permission to access this order');
    }
}

export const pod_printfulGetOrder = onCall({ secrets: [printfulApiKey, arcjetKey], enforceAppCheck: true }, async (req) => {
    const uid = await requireAuth(req, 'get-order');
    const orderId = assertSafeApiPathSegment(req.data?.orderId, 'orderId');
    await verifyOrderOwnership(uid, orderId);
    return await printfulRequest<unknown>(`/orders/${encodeURIComponent(orderId)}`);
});

export const pod_printfulCancelOrder = onCall({ secrets: [printfulApiKey, arcjetKey], enforceAppCheck: true }, async (req) => {
    const uid = await requireAuth(req, 'cancel-order');
    const orderId = assertSafeApiPathSegment(req.data?.orderId, 'orderId');
    await verifyOrderOwnership(uid, orderId);
    const result = await printfulRequest<unknown>(`/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
    await getFirestore().collection('users').doc(uid).collection('pod_orders').doc(orderId).update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
    });
    return result;
});

export const pod_printfulGenerateMockup = onCall({ secrets: [printfulApiKey, arcjetKey], enforceAppCheck: true }, async (req) => {
    await requireAuth(req, 'generate-mockup');
    const designUrl = assertSafeExternalHttpsUrl(req.data?.designUrl, 'designUrl');
    const result = await printfulRequest<unknown>('/mockup-generator/create-task', {
        method: 'POST',
        body: JSON.stringify({
            variant_ids: [parseInt(req.data.variantId)],
            files: [{
                placement: req.data.printArea,
                image_url: designUrl
            }]
        })
    });

    const taskId = (result as { task_key: string }).task_key;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const status = await printfulRequest<unknown>(`/mockup-generator/task?task_key=${taskId}`);
        const typedStatus = status as { status: string, mockups?: Array<{ mockup_url: string }> };

        if (typedStatus.status === 'completed') {
            return typedStatus.mockups?.[0]?.mockup_url || '';
        }

        if (typedStatus.status === 'failed') {
            throw new HttpsError('internal', 'Mockup generation failed');
        }
        attempts++;
    }
    throw new HttpsError('deadline-exceeded', 'Mockup generation timed out');
});
