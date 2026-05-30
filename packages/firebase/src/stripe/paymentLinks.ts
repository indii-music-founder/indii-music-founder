import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { stripe } from './config';

export const createStripePaymentLinks = onCall(async (req) => {
    if (!req.auth) {
        throw new HttpsError('unauthenticated', 'User must be signed in.');
    }

    const { campaignName, items, idempotencyKey } = req.data as { campaignName: string, items: string[], idempotencyKey?: string };
    if (!campaignName || !items || !Array.isArray(items)) {
        throw new HttpsError('invalid-argument', 'Missing campaignName or items array.');
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const paymentLinks: string[] = [];
        const baseIKey = idempotencyKey || `pl_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
        
        const product = await stripe.products.create({
            name: `${campaignName} - Storefront Items`,
            description: `Items: ${items.join(', ')}`
        }, { idempotencyKey: `${baseIKey}_prod` });

        const price = await stripe.prices.create({
            product: product.id,
            unit_amount: 2500, // $25.00 default price
            currency: 'usd',
        }, { idempotencyKey: `${baseIKey}_price` });

        const paymentLink = await stripe.paymentLinks.create({
            line_items: [{ price: price.id, quantity: 1 }],
        }, { idempotencyKey: `${baseIKey}_link` });

        return {
            storefrontUrl: paymentLink.url,
            paymentLinks: [paymentLink.url]
        };
    } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        throw new HttpsError('internal', `Failed to create Stripe payment links: ${error.message}`);
    }
});
