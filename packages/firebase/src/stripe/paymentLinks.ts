import crypto from 'crypto';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { stripe } from './config';

export interface StorefrontItemInput {
    sku: string;
    title: string;
    unitAmount: number;
    currency: string;
    quantity: number;
    stock: number;
    taxCode?: string;
    taxBehavior?: 'inclusive' | 'exclusive' | 'unspecified';
    shippingRequired: boolean;
    fulfillmentProvider: string;
    payoutMetadata?: Record<string, string>;
}

export interface StorefrontCheckoutInput {
    campaignName: string;
    items: StorefrontItemInput[];
    shippingAllowedCountries?: string[];
    automaticTax?: boolean;
    idempotencyKey?: string;
}

interface StripeCreateResult {
    id: string;
    url?: string | null;
}

export interface StorefrontStripeClient {
    products: {
        create(params: Record<string, unknown>, options: { idempotencyKey: string }): Promise<StripeCreateResult>;
    };
    prices: {
        create(params: Record<string, unknown>, options: { idempotencyKey: string }): Promise<StripeCreateResult>;
    };
    paymentLinks: {
        create(params: Record<string, unknown>, options: { idempotencyKey: string }): Promise<StripeCreateResult>;
    };
}

const CURRENCY_PATTERN = /^[a-zA-Z]{3}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const METADATA_KEY_PATTERN = /^[a-zA-Z0-9_.-]{1,40}$/;

function invalid(message: string): never {
    throw new HttpsError('invalid-argument', message);
}

function validateMetadata(metadata: Record<string, string> | undefined, itemIndex: number): Record<string, string> {
    if (!metadata) return {};

    const entries = Object.entries(metadata);
    if (entries.length > 10) invalid(`Item ${itemIndex + 1} payoutMetadata may contain at most 10 entries.`);

    return Object.fromEntries(entries.map(([key, value]) => {
        if (!METADATA_KEY_PATTERN.test(key)) {
            invalid(`Item ${itemIndex + 1} payoutMetadata key "${key}" is invalid.`);
        }
        if (typeof value !== 'string' || value.length > 200) {
            invalid(`Item ${itemIndex + 1} payoutMetadata value for "${key}" must be a string of at most 200 characters.`);
        }
        return [`payout.${key}`, value];
    }));
}

export function validateStorefrontCheckoutInput(value: unknown): StorefrontCheckoutInput {
    if (!value || typeof value !== 'object') invalid('Checkout input is required.');
    const input = value as Partial<StorefrontCheckoutInput>;
    const campaignName = typeof input.campaignName === 'string' ? input.campaignName.trim() : '';
    if (!campaignName) invalid('campaignName is required.');
    if (campaignName.length > 120) invalid('campaignName must be 120 characters or fewer.');
    if (!Array.isArray(input.items) || input.items.length === 0) invalid('At least one priced item is required.');
    if (input.items.length > 20) invalid('A checkout preview may contain at most 20 items.');

    const seenSkus = new Set<string>();
    const items = input.items.map((rawItem, index) => {
        if (!rawItem || typeof rawItem !== 'object') invalid(`Item ${index + 1} is invalid.`);
        const item = rawItem as Partial<StorefrontItemInput>;
        const sku = typeof item.sku === 'string' ? item.sku.trim() : '';
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        const currency = typeof item.currency === 'string' ? item.currency.toLowerCase() : '';
        const fulfillmentProvider = typeof item.fulfillmentProvider === 'string'
            ? item.fulfillmentProvider.trim()
            : '';

        if (!sku || sku.length > 80) invalid(`Item ${index + 1} requires a SKU of at most 80 characters.`);
        if (seenSkus.has(sku)) invalid(`Duplicate SKU: ${sku}.`);
        seenSkus.add(sku);
        if (!title || title.length > 120) invalid(`Item ${index + 1} requires a title of at most 120 characters.`);
        if (!Number.isInteger(item.unitAmount) || Number(item.unitAmount) <= 0) {
            invalid(`Item ${index + 1} requires unitAmount as a positive integer in the currency's smallest unit.`);
        }
        if (!CURRENCY_PATTERN.test(currency)) invalid(`Item ${index + 1} requires a three-letter currency code.`);
        if (!Number.isInteger(item.quantity) || Number(item.quantity) <= 0) invalid(`Item ${index + 1} requires a positive integer quantity.`);
        if (!Number.isInteger(item.stock) || Number(item.stock) < Number(item.quantity)) {
            invalid(`Item ${index + 1} stock must be an integer greater than or equal to quantity.`);
        }
        if (typeof item.shippingRequired !== 'boolean') invalid(`Item ${index + 1} requires shippingRequired.`);
        if (!fulfillmentProvider) invalid(`Item ${index + 1} requires a fulfillmentProvider.`);
        if (item.taxBehavior && !['inclusive', 'exclusive', 'unspecified'].includes(item.taxBehavior)) {
            invalid(`Item ${index + 1} taxBehavior is invalid.`);
        }

        return {
            sku,
            title,
            unitAmount: Number(item.unitAmount),
            currency,
            quantity: Number(item.quantity),
            stock: Number(item.stock),
            taxCode: typeof item.taxCode === 'string' && item.taxCode.trim() ? item.taxCode.trim() : undefined,
            taxBehavior: item.taxBehavior,
            shippingRequired: item.shippingRequired,
            fulfillmentProvider,
            payoutMetadata: validateMetadata(item.payoutMetadata, index),
        } satisfies StorefrontItemInput;
    });

    const currencies = new Set(items.map((item) => item.currency));
    if (currencies.size !== 1) invalid('All checkout items must use the same currency.');

    const shippingRequired = items.some((item) => item.shippingRequired);
    const shippingAllowedCountries = input.shippingAllowedCountries?.map((country) => country.toUpperCase()) ?? [];
    if (shippingRequired && shippingAllowedCountries.length === 0) {
        invalid('shippingAllowedCountries is required when an item requires shipping.');
    }
    if (shippingAllowedCountries.some((country) => !COUNTRY_PATTERN.test(country))) {
        invalid('shippingAllowedCountries must contain two-letter ISO country codes.');
    }
    if (input.idempotencyKey !== undefined
        && (typeof input.idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(input.idempotencyKey))) {
        invalid('idempotencyKey must be 8-120 letters, numbers, underscores, or hyphens.');
    }

    return {
        campaignName,
        items,
        shippingAllowedCountries: [...new Set(shippingAllowedCountries)],
        automaticTax: input.automaticTax === true,
        idempotencyKey: input.idempotencyKey,
    };
}

export async function createStorefrontCheckout(
    rawInput: unknown,
    client: StorefrontStripeClient,
) {
    const input = validateStorefrontCheckoutInput(rawInput);
    const baseKey = input.idempotencyKey || `checkout_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
    const lineItems: Array<{ price: string; quantity: number }> = [];
    const checkoutItems: Array<{
        sku: string;
        title: string;
        priceId: string;
        unitAmount: number;
        currency: string;
        quantity: number;
        stock: number;
        fulfillmentProvider: string;
    }> = [];

    for (const [index, item] of input.items.entries()) {
        const product = await client.products.create({
            name: item.title,
            ...(item.taxCode ? { tax_code: item.taxCode } : {}),
            metadata: {
                campaign: input.campaignName,
                sku: item.sku,
                stock: String(item.stock),
                fulfillment_provider: item.fulfillmentProvider,
                ...item.payoutMetadata,
            },
        }, { idempotencyKey: `${baseKey}_product_${index}` });

        const price = await client.prices.create({
            product: product.id,
            unit_amount: item.unitAmount,
            currency: item.currency,
            ...(item.taxBehavior ? { tax_behavior: item.taxBehavior } : {}),
        }, { idempotencyKey: `${baseKey}_price_${index}` });

        lineItems.push({ price: price.id, quantity: item.quantity });
        checkoutItems.push({
            sku: item.sku,
            title: item.title,
            priceId: price.id,
            unitAmount: item.unitAmount,
            currency: item.currency,
            quantity: item.quantity,
            stock: item.stock,
            fulfillmentProvider: item.fulfillmentProvider,
        });
    }

    const requiresShipping = input.items.some((item) => item.shippingRequired);
    const paymentLink = await client.paymentLinks.create({
        line_items: lineItems,
        ...(input.automaticTax ? { automatic_tax: { enabled: true } } : {}),
        ...(requiresShipping ? {
            shipping_address_collection: { allowed_countries: input.shippingAllowedCountries },
        } : {}),
        metadata: {
            campaign: input.campaignName,
            checkout_type: 'storefront_preview',
        },
    }, { idempotencyKey: `${baseKey}_payment_link` });

    if (!paymentLink.url) throw new Error('Stripe did not return a payment-link URL.');

    return {
        checkoutPreviewUrl: paymentLink.url,
        checkoutItems,
        currency: input.items[0].currency,
        fulfillmentReady: false,
        inventoryEnforced: false,
        note: 'Stripe checkout preview only. Stock and fulfillment metadata are recorded but require a separate inventory and fulfillment integration.',
    };
}

export const createStripePaymentLinks = onCall(async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'User must be signed in.');

    try {
        return await createStorefrontCheckout(req.data, stripe as unknown as StorefrontStripeClient);
    } catch (error: unknown) {
        if (error instanceof HttpsError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw new HttpsError('internal', `Failed to create Stripe checkout preview: ${message}`);
    }
});
