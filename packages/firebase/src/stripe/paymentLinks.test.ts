import { describe, expect, it, vi } from 'vitest';
import {
    createStorefrontCheckout,
    validateStorefrontCheckoutInput,
    type StorefrontStripeClient,
} from './paymentLinks';

function validInput() {
    return {
        campaignName: 'Summer Drop',
        items: [
            {
                sku: 'TEE-BLK-M',
                title: 'Black Tee — Medium',
                unitAmount: 3000,
                currency: 'USD',
                quantity: 2,
                stock: 12,
                taxCode: 'txcd_99999999',
                taxBehavior: 'exclusive' as const,
                shippingRequired: true,
                fulfillmentProvider: 'printful',
                payoutMetadata: { artistShare: '80' },
            },
            {
                sku: 'POSTER-A2',
                title: 'Tour Poster',
                unitAmount: 1500,
                currency: 'usd',
                quantity: 1,
                stock: 40,
                shippingRequired: true,
                fulfillmentProvider: 'printful',
            },
        ],
        shippingAllowedCountries: ['us', 'CA'],
        automaticTax: true,
        idempotencyKey: 'summer_drop_2026',
    };
}

function stripeClient(): StorefrontStripeClient {
    let product = 0;
    let price = 0;
    return {
        products: { create: vi.fn(async () => ({ id: `prod_${++product}` })) },
        prices: { create: vi.fn(async () => ({ id: `price_${++price}` })) },
        paymentLinks: { create: vi.fn(async () => ({ id: 'plink_1', url: 'https://buy.stripe.com/test' })) },
    };
}

describe('validateStorefrontCheckoutInput', () => {
    it('rejects legacy unpriced string items', () => {
        expect(() => validateStorefrontCheckoutInput({ campaignName: 'Drop', items: ['T-shirt'] }))
            .toThrow('Item 1 is invalid');
    });

    it('rejects missing prices and stock below requested quantity', () => {
        const missingPrice = validInput();
        delete (missingPrice.items[0] as Partial<typeof missingPrice.items[0]>).unitAmount;
        expect(() => validateStorefrontCheckoutInput(missingPrice)).toThrow('requires unitAmount');

        const shortStock = validInput();
        shortStock.items[0].stock = 1;
        expect(() => validateStorefrontCheckoutInput(shortStock)).toThrow('stock must be');
    });

    it('rejects mixed currencies and physical items without shipping countries', () => {
        const mixed = validInput();
        mixed.items[1].currency = 'eur';
        expect(() => validateStorefrontCheckoutInput(mixed)).toThrow('same currency');

        const missingCountries = validInput();
        missingCountries.shippingAllowedCountries = [];
        expect(() => validateStorefrontCheckoutInput(missingCountries)).toThrow('shippingAllowedCountries');
    });
});

describe('createStorefrontCheckout', () => {
    it('creates a distinct product and price per SKU and one itemized checkout', async () => {
        const client = stripeClient();
        const result = await createStorefrontCheckout(validInput(), client);

        expect(client.products.create).toHaveBeenCalledTimes(2);
        expect(client.prices.create).toHaveBeenCalledTimes(2);
        expect(client.prices.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
            product: 'prod_1',
            unit_amount: 3000,
            currency: 'usd',
        }), { idempotencyKey: 'summer_drop_2026_price_0' });
        expect(client.prices.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
            product: 'prod_2',
            unit_amount: 1500,
            currency: 'usd',
        }), { idempotencyKey: 'summer_drop_2026_price_1' });
        expect(client.paymentLinks.create).toHaveBeenCalledWith(expect.objectContaining({
            line_items: [
                { price: 'price_1', quantity: 2 },
                { price: 'price_2', quantity: 1 },
            ],
            automatic_tax: { enabled: true },
            shipping_address_collection: { allowed_countries: ['US', 'CA'] },
        }), { idempotencyKey: 'summer_drop_2026_payment_link' });
        expect(result).toMatchObject({
            checkoutPreviewUrl: 'https://buy.stripe.com/test',
            fulfillmentReady: false,
            inventoryEnforced: false,
        });
        expect(result.checkoutItems).toHaveLength(2);
    });

    it('does not add shipping collection for digital-only items', async () => {
        const input = validInput();
        input.items.forEach((item) => { item.shippingRequired = false; });
        input.shippingAllowedCountries = [];
        const client = stripeClient();

        await createStorefrontCheckout(input, client);

        expect(client.paymentLinks.create).toHaveBeenCalledWith(
            expect.not.objectContaining({ shipping_address_collection: expect.anything() }),
            expect.anything(),
        );
    });
});
