import { onCall, HttpsError } from 'firebase-functions/v2/https';
import fetch from 'node-fetch';
import { printfulApiKey, getPrintfulApiKey } from '../config/secrets';

const BASE_URL = 'https://api.printful.com';

async function request<T>(endpoint: string, options: { method?: string; body?: string; headers?: Record<string, string> } = {}): Promise<T> {
    const apiKey = getPrintfulApiKey();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout
    
    let response;
    try {
        response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            signal: controller.signal as any,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        if (e.name === 'AbortError') {
            throw new HttpsError('deadline-exceeded', 'Printful API request timed out.');
        }
        throw new HttpsError('internal', `Printful API request failed: ${e.message}`);
    } finally {
        clearTimeout(timeout);
    }

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }));
        throw new HttpsError('internal', `Printful API error: ${errorBody.error?.message || errorBody.message || response.statusText}`);
    }

    const data = await response.json() as { result: T };
    return data.result;
}

export const pod_printfulGetProducts = onCall({ secrets: [printfulApiKey] }, async () => {
    return await request<unknown[]>('/store/products');
});

export const pod_printfulGetProduct = onCall({ secrets: [printfulApiKey] }, async (req) => {
    return await request<unknown>(`/store/products/${req.data.productId}`);
});

export const pod_printfulCalculatePrice = onCall({ secrets: [printfulApiKey] }, async (req) => {
    return await request<unknown>('/orders/estimate-costs', {
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

export const pod_printfulGetShippingRates = onCall({ secrets: [printfulApiKey] }, async (req) => {
    return await request<unknown[]>('/shipping/rates', {
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

export const pod_printfulCreateOrder = onCall({ secrets: [printfulApiKey] }, async (req) => {
    return await request<unknown>('/orders', {
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
});

export const pod_printfulGetOrder = onCall({ secrets: [printfulApiKey] }, async (req) => {
    return await request<unknown>(`/orders/${req.data.orderId}`);
});

export const pod_printfulCancelOrder = onCall({ secrets: [printfulApiKey] }, async (req) => {
    return await request<unknown>(`/orders/${req.data.orderId}`, { method: 'DELETE' });
});

export const pod_printfulGenerateMockup = onCall({ secrets: [printfulApiKey] }, async (req) => {
    const result = await request<unknown>('/mockup-generator/create-task', {
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
        const status = await request<unknown>(`/mockup-generator/task?task_key=${taskId}`);
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
