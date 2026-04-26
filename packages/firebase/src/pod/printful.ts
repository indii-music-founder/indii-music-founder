import * as functions from 'firebase-functions';
import fetch from 'node-fetch';

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const BASE_URL = 'https://api.printful.com';

async function request<T>(endpoint: string, options: any = {}): Promise<T> {
    if (!PRINTFUL_API_KEY) {
        throw new functions.https.HttpsError('internal', 'Printful API key not configured.');
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
        throw new functions.https.HttpsError('internal', `Printful API error: ${errorBody.error?.message || errorBody.message || response.statusText}`);
    }

    const data = await response.json();
    return data.result as T;
}

export const pod_printfulGetProducts = functions.https.onCall(async () => {
    return await request<any[]>('/store/products');
});

export const pod_printfulGetProduct = functions.https.onCall(async (data) => {
    return await request<any>(`/store/products/${data.productId}`);
});

export const pod_printfulCalculatePrice = functions.https.onCall(async (data) => {
    return await request<any>('/orders/estimate-costs', {
        method: 'POST',
        body: JSON.stringify({
            items: data.items.map((item: any) => ({
                sync_variant_id: item.variantId,
                quantity: item.quantity,
                files: [{ url: item.designUrl }]
            }))
        })
    });
});

export const pod_printfulGetShippingRates = functions.https.onCall(async (data) => {
    return await request<any[]>('/shipping/rates', {
        method: 'POST',
        body: JSON.stringify({
            recipient: {
                address1: data.address.address1,
                city: data.address.city,
                state_code: data.address.stateCode,
                country_code: data.address.countryCode,
                zip: data.address.postalCode
            },
            items: data.items.map((item: any) => ({
                sync_variant_id: item.variantId,
                quantity: item.quantity
            }))
        })
    });
});

export const pod_printfulCreateOrder = functions.https.onCall(async (data) => {
    return await request<any>('/orders', {
        method: 'POST',
        body: JSON.stringify({
            recipient: {
                name: data.address.name,
                company: data.address.company,
                address1: data.address.address1,
                address2: data.address.address2,
                city: data.address.city,
                state_code: data.address.stateCode,
                country_code: data.address.countryCode,
                zip: data.address.postalCode,
                phone: data.address.phone,
                email: data.address.email
            },
            items: data.items.map((item: any) => ({
                sync_variant_id: item.variantId,
                quantity: item.quantity,
                files: [{
                    url: item.designUrl,
                    position: item.printArea
                }]
            })),
            shipping: data.shippingMethod
        })
    });
});

export const pod_printfulGetOrder = functions.https.onCall(async (data) => {
    return await request<any>(`/orders/${data.orderId}`);
});

export const pod_printfulCancelOrder = functions.https.onCall(async (data) => {
    return await request<any>(`/orders/${data.orderId}`, { method: 'DELETE' });
});

export const pod_printfulGenerateMockup = functions.https.onCall(async (data) => {
    const result = await request<any>('/mockup-generator/create-task', {
        method: 'POST',
        body: JSON.stringify({
            variant_ids: [parseInt(data.variantId)],
            files: [{
                placement: data.printArea,
                image_url: data.designUrl
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
            throw new functions.https.HttpsError('internal', 'Mockup generation failed');
        }
        attempts++;
    }
    throw new functions.https.HttpsError('deadline-exceeded', 'Mockup generation timed out');
});
