import { onCall, HttpsError } from 'firebase-functions/v2/https';
import fetch from 'node-fetch';

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const BASE_URL = 'https://api.printful.com';

async function request<T>(endpoint: string, options: any = {}): Promise<T> {
    if (!PRINTFUL_API_KEY) {
        throw new HttpsError('internal', 'Printful API key not configured.');
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        throw new HttpsError('internal', `Printful API error: ${errorBody.error?.message || errorBody.message || response.statusText}`);
    }

    const data = await response.json();
    return data.result as T;
}

export const pod_printfulGetProducts = onCall(async () => {
    return await request<any[]>('/store/products');
});

export const pod_printfulGetProduct = onCall(async (req) => {
    return await request<any>(`/store/products/${req.data.productId}`);
});

export const pod_printfulCalculatePrice = onCall(async (req) => {
    return await request<any>('/orders/estimate-costs', {
        method: 'POST',
        body: JSON.stringify({
            items: req.data.items.map((item: any) => ({
                sync_variant_id: item.variantId,
                quantity: item.quantity,
                files: [{ url: item.designUrl }]
            }))
        })
    });
});

export const pod_printfulGetShippingRates = onCall(async (req) => {
    return await request<any[]>('/shipping/rates', {
        method: 'POST',
        body: JSON.stringify({
            recipient: {
                address1: req.data.address.address1,
                city: req.data.address.city,
                state_code: req.data.address.stateCode,
                country_code: req.data.address.countryCode,
                zip: req.data.address.postalCode
            },
            items: req.data.items.map((item: any) => ({
                sync_variant_id: item.variantId,
                quantity: item.quantity
            }))
        })
    });
});

export const pod_printfulCreateOrder = onCall(async (req) => {
    return await request<any>('/orders', {
        method: 'POST',
        body: JSON.stringify({
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
            items: req.data.items.map((item: any) => ({
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
});

export const pod_printfulGetOrder = onCall(async (req) => {
    return await request<any>(`/orders/${req.data.orderId}`);
});

export const pod_printfulCancelOrder = onCall(async (req) => {
    return await request<any>(`/orders/${req.data.orderId}`, { method: 'DELETE' });
});

export const pod_printfulGenerateMockup = onCall(async (req) => {
    const result = await request<any>('/mockup-generator/create-task', {
        method: 'POST',
        body: JSON.stringify({
            variant_ids: [parseInt(req.data.variantId)],
            files: [{
                placement: req.data.printArea,
                image_url: req.data.designUrl
            }]
        })
    });

    const taskId = result.task_key;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const status = await request<any>(`/mockup-generator/task?task_key=${taskId}`);

        if (status.status === 'completed') {
            return status.mockups?.[0]?.mockup_url || '';
        }

        if (status.status === 'failed') {
            throw new HttpsError('internal', 'Mockup generation failed');
        }
        attempts++;
    }
    throw new HttpsError('deadline-exceeded', 'Mockup generation timed out');
});
