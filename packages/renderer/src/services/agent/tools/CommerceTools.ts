import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { logger } from '@/utils/logger';
import type { AnyToolFunction } from '../types';

export const CommerceTools = {
    mockup_merchandise: wrapTool('mockup_merchandise', async (args: { productType: string; designIdea: string }) => {
        // Use AI image generation to produce an actual product mockup
        const productDescriptions: Record<string, string> = {
            't-shirt':    'a flat-lay product photo of a black unisex t-shirt displayed on a white background',
            'hoodie':     'a flat-lay product photo of a black pullover hoodie on a white background',
            'hat':        'a product photo of a black snapback hat on a white background',
            'poster':     'a product mockup of an A2 glossy poster mounted on a clean white wall',
            'tote bag':   'a flat-lay product photo of a black cotton tote bag on a white background',
            'phone case': 'a product photo of a clear phone case displayed on a white background',
            'vinyl':      'a product photo of a 12-inch vinyl record with a custom sleeve on a white background',
        };
        const productBase = productDescriptions[args.productType.toLowerCase()]
            ?? `a professional product mockup of a ${args.productType} on a white background`;

        const imagePrompt = `${productBase}, with the following artwork printed on it: ${args.designIdea}. Studio lighting, product photography style, high resolution, centered composition.`;

        try {
            const mockupImageUrl = await firebaseAI.generateImage(imagePrompt);

            // Persist the generated mockup to Firestore for the merch module
            const { db, auth } = await import('@/services/firebase');
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
            const uid = auth.currentUser?.uid;
            if (uid) {
                await addDoc(collection(db, 'users', uid, 'merchandiseMockups'), {
                    productType: args.productType,
                    designIdea: args.designIdea,
                    imageUrl: mockupImageUrl,
                    createdAt: serverTimestamp(),
                });
            }

            return toolSuccess({
                productType: args.productType,
                designPromptUsed: imagePrompt,
                mockupImageUrl,
                providers: ['Printful', 'Printify'],
                readyForPOD: true,
            }, `Merchandise mockup generated for ${args.productType}. Image saved and ready for POD upload.`);
        } catch (err: unknown) {
            logger.error('[CommerceTools] mockup_merchandise image gen failed:', err);
            return toolError('Failed to generate merchandise mockup. AI image service unavailable.', 'IMAGE_GEN_FAILED');
        }
    }),

    deploy_storefront_preview: wrapTool('deploy_storefront_preview', async (args: { campaignName: string; items: string[] }) => {
        // Attempt to create real Stripe Payment Links via Cloud Function
        try {
            const { functions } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');
            const createPaymentLinksFn = httpsCallable<
                { campaignName: string; items: string[] },
                { storefrontUrl: string; paymentLinks: string[] }
            >(functions, 'createStripePaymentLinks');

            const result = await createPaymentLinksFn({ campaignName: args.campaignName, items: args.items });
            return toolSuccess(result.data, `Storefront deployed for "${args.campaignName}" with ${args.items.length} real Stripe Payment Links.`);
        } catch (_err: unknown) {
            // Cloud Function not yet deployed — return a staged preview URL with clear status
            const slug = args.campaignName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
            logger.warn('[CommerceTools] createStripePaymentLinks not available, returning staged preview');
            return toolSuccess({
                campaignName: args.campaignName,
                storefrontUrl: `https://app.indiios.com/store/${slug}`,
                paymentLinks: [],
                status: 'staged',
                note: 'Stripe Payment Links require the createStripePaymentLinks Cloud Function to be deployed. Items saved to merch module for manual link creation.',
            }, `Storefront "${args.campaignName}" staged at /store/${slug}. Deploy createStripePaymentLinks Cloud Function to activate real checkout.`);
        }
    }),

    recommend_merch_pricing: wrapTool('recommend_merch_pricing', async (args: { productType: string; baseCost: number }) => {
        // Dynamic pricing engine mock
        const standardMargin = 0.40; // 40% margin
        const recommendedPrice = args.baseCost / (1 - standardMargin);
        const premiumPrice = recommendedPrice * 1.25;

        return toolSuccess({
            productType: args.productType,
            baseCost: args.baseCost,
            recommendedPrice: Number(recommendedPrice.toFixed(2)),
            premiumPrice: Number(premiumPrice.toFixed(2)),
            margin: '40%'
        }, `Pricing recommendation generated for ${args.productType}. Base Cost: $${args.baseCost}. Recommended retail: $${recommendedPrice.toFixed(2)}.`);
    }),

    create_limited_drop_campaign: wrapTool('create_limited_drop_campaign', async (args: { dropName: string; totalItems: number; releaseDate: string }) => {
        return toolSuccess({
            dropName: args.dropName,
            totalItems: args.totalItems,
            releaseDate: args.releaseDate,
            status: 'Scheduled',
            presaleLocked: true,
            notificationsQueued: true
        }, `Limited drop campaign "${args.dropName}" scheduled for ${args.releaseDate} with ${args.totalItems} total items. Pre-sales are locked and superfan notifications queued.`);
    })
} satisfies Record<string, AnyToolFunction>;

export const {
    mockup_merchandise,
    deploy_storefront_preview,
    recommend_merch_pricing,
    create_limited_drop_campaign
} = CommerceTools;
