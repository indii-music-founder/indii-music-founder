import { onCall, HttpsError } from 'firebase-functions/v2/https';
import fetch from 'node-fetch';
import { printfulApiKey } from '../config/secrets';
import { printfulRequest } from './printfulApi';
import { getFirestore } from 'firebase-admin/firestore';

const BASE_URL = 'https://api.printful.com';

function requireAuth(req: any) {
    if (!req.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    return req.auth.uid;
}

export const pod_printfulGetProducts = onCall({ secrets: [printfulApiKey], enforceAppCheck: true }, async (req) => {
    requireAuth(req);
    return await printfulRequest<unknown[]>('/store/products');
});

export const pod_printfulGetProduct = onCall({ secrets: [printfulApiKey], enforceAppCheck: true }, async (req) => {
    requireAuth(req);
    return await printfulRequest<unknown>(`/store/products/${req.data.productId}`);
});

export const pod_printfulCalculatePrice = onCall({ secrets: [printfulApiKey], enforceAppCheck: true }, async (req) => {
    requireAuth(req);
    return await printfulRequest<unknown>('/orders/estimate-costs', {
        method: 'POST',
        body: JSON.stringify({
            items: req.data.items.map((item: Record<string, unknown>) => ({
                sync_variant_id: item.variantId,
                quantity: item.quantity,
                files: [{ url: item.designUrl }]
            }))
        })
    });
});

export const pod_printfulGetShippingRates = onCall({ secrets: [printfulApiKey], enforceAppCheck: true }, async (req) => {
    requireAuth(req);
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

export const pod_printfulCreateOrder = onCall({ secrets: [printfulApiKey], enforceAppCheck: true }, async (req) => {
    const uid = requireAuth(req);
    
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
                name: req.data.address.name,
                company: req.data.address.company,
                address1: req.data.address.address1,
                address2: req.data.address.address2,
                city: req.data.address.city,
                state_code: req.data.address.stateCode,
                country_code: req.data.address.countryCode,
                zip: req.data.address.postalCode,
                phone: req.data.address.phone,
                email: req.data.address.email
            },
            items: req.data.items.map((item: Record<string, unknown>) => ({
                sync_variant_id: item.variantId,
                quantity: item.quantity,
                files: [{
                    url: item.designUrl,
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

export const pod_printfulGetOrder = onCall({ secrets: [printfulApiKey], enforceAppCheck: true }, async (req) => {
    const uid = requireAuth(req);
    await verifyOrderOwnership(uid, req.data.orderId);
    return await printfulRequest<unknown>(`/orders/${req.data.orderId}`);
});

export const pod_printfulCancelOrder = onCall({ secrets: [printfulApiKey], enforceAppCheck: true }, async (req) => {
    const uid = requireAuth(req);
    await verifyOrderOwnership(uid, req.data.orderId);
    const result = await printfulRequest<unknown>(`/orders/${req.data.orderId}`, { method: 'DELETE' });
    await getFirestore().collection('users').doc(uid).collection('pod_orders').doc(String(req.data.orderId)).update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
    });
    return result;
});

export const pod_printfulGenerateMockup = onCall({ secrets: [printfulApiKey], enforceAppCheck: true }, async (req) => {
    requireAuth(req);
    const result = await printfulRequest<unknown>('/mockup-generator/create-task', {
        method: 'POST',
        body: JSON.stringify({
            variant_ids: [parseInt(req.data.variantId)],
            files: [{
                placement: req.data.printArea,
                image_url: req.data.designUrl
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
