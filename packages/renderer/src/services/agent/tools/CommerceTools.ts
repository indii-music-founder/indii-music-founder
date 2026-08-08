import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { logger } from '@/utils/logger';
import type { AnyToolFunction } from '../types';
import { importWithRetry } from '@/utils/dynamicImport';
import { limitedDropService } from '@/services/commerce/LimitedDropService';

export const CommerceTools = {
    mockup_merchandise: wrapTool('mockup_merchandise', async (args: { productType: string; designIdea: string }) => {
        // Use Intelligence image generation to produce an actual product mockup
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
            const mockupImageUrl = await AutonomousIntelligence.generateImage(imagePrompt);

            // Persist the generated mockup to Firestore for the merch module
            const { db, auth } = await importWithRetry(() => import('@/services/firebase'));
            const { collection, addDoc, serverTimestamp } = await importWithRetry(() => import('firebase/firestore'));
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
                readyForPOD: false,
                reason: 'AI mockup preview only. Requires product variant ID, print-area mapping, DPI verification, and provider file acceptance before upload.',
            }, `Merchandise mockup preview generated for ${args.productType}. This is a visual reference only—not production-ready for upload.`);
        } catch (err: unknown) {
            logger.error('[CommerceTools] mockup_merchandise image gen failed:', err);
            return toolError('Failed to generate merchandise mockup. Intelligence image service unavailable.', 'IMAGE_GEN_FAILED');
        }
    }),

    deploy_storefront_preview: wrapTool('deploy_storefront_preview', async (args: { campaignName: string; items: string[] }) => {
        // Attempt to create real Stripe Payment Links via Cloud Function
        try {
            const { functions } = await importWithRetry(() => import('@/services/firebase'));
            const { httpsCallable } = await importWithRetry(() => import('firebase/functions'));
            const createPaymentLinksFn = httpsCallable(functions, 'createStripePaymentLinks');

            const result = await createPaymentLinksFn({ campaignName: args.campaignName, items: args.items }) as { data: { storefrontUrl: string; paymentLinks: string[] } };
            return toolSuccess(result.data, `Storefront deployed for "${args.campaignName}" with ${args.items.length} real Stripe Payment Links.`);
        } catch (_err: unknown) {
            logger.warn('[CommerceTools] createStripePaymentLinks not available');
            return toolError(
                'Storefront preview deployment requires the createStripePaymentLinks Cloud Function.',
                'STOREFRONT_BACKEND_UNAVAILABLE'
            );
        }
    }),

    recommend_merch_pricing: wrapTool('recommend_merch_pricing', async (args: { productType: string; baseCost: number }) => {
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

    create_limited_drop_campaign: wrapTool('create_limited_drop_campaign', async (args: {
        dropName: string;
        releaseDate?: string;
        dropDate?: string;
        productIds?: string[];
        productId?: string;
        presaleEnabled?: boolean;
        superfanOnly?: boolean;
        countdownMessage?: string;
        notifyFans?: boolean;
    }) => {
        try {
            const productIds = [...new Set([
                ...(args.productIds ?? []),
                ...(args.productId ? [args.productId] : []),
            ])];
            const dateInput = args.releaseDate ?? args.dropDate ?? '';
            const result = await limitedDropService.createDraft({
                selectedProductIds: productIds,
                dropName: args.dropName,
                dropDateTime: new Date(dateInput),
                presaleEnabled: args.presaleEnabled ?? false,
                superfanOnly: args.superfanOnly ?? false,
                countdownMessage: args.countdownMessage ?? '',
            });

            return toolSuccess({
                dropId: result.dropId,
                dropName: args.dropName,
                productIds,
                dropDateTime: dateInput,
                status: result.status,
                notificationStatus: result.notificationStatus,
                notificationRequested: args.notifyFans === true,
            }, `Limited drop "${args.dropName}" was saved as a draft. It is not live; fan notifications require a configured notification provider.`);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            const code = /sign in/i.test(msg) ? 'AUTH_REQUIRED' : 'LIMITED_DROP_CREATE_FAILED';
            return toolError(`Failed to save limited-drop draft: ${msg}`, code);
        }
    })
} satisfies Record<string, AnyToolFunction>;

export const {
    mockup_merchandise,
    deploy_storefront_preview,
    recommend_merch_pricing,
    create_limited_drop_campaign
} = CommerceTools;
