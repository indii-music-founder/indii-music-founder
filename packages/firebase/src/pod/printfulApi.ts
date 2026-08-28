/**
 * Thin Printful HTTP surface with NO Cloud Function declarations.
 *
 * Kept separate from pod/printful.ts so server-side consumers that are not
 * callables (stripe/webhookHandler.ts POD gate, pod/checkout.ts) can import
 * these helpers without dragging onCall registrations into their module
 * graph — test harnesses mock the functions runtime and must not need onCall.
 */

import fetch from 'node-fetch';
import { HttpsError } from 'firebase-functions/v2/https';
import { getPrintfulApiKey } from '../config/secrets';

const BASE_URL = 'https://api.printful.com';

export async function printfulRequest<T>(
  endpoint: string,
  options: { method?: string; body?: string; headers?: Record<string, string> } = {},
): Promise<T> {
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
        ...options.headers,
      },
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

export async function getPrintfulOrder<T = Record<string, unknown>>(orderId: string | number): Promise<T> {
  return printfulRequest<T>(`/orders/${orderId}`);
}

export async function estimatePrintfulOrderCosts<T = Record<string, unknown>>(
  order: { items?: Array<Record<string, unknown>>; recipient?: Record<string, unknown> },
): Promise<T> {
  return printfulRequest<T>('/orders/estimate-costs', {
    method: 'POST',
    body: JSON.stringify({
      recipient: order.recipient ?? {},
      items: (order.items ?? []).map((item) => ({
        sync_variant_id: item.sync_variant_id,
        quantity: item.quantity,
        files: item.files ?? [],
      })),
    }),
  });
}

export async function confirmPrintfulOrder<T = Record<string, unknown>>(orderId: string | number): Promise<T> {
  return printfulRequest<T>(`/orders/${orderId}/confirm`, { method: 'POST', body: JSON.stringify({}) });
}
