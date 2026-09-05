import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { logger } from '@/utils/logger';
import type { AnyToolFunction } from '../types';
import { importWithRetry } from '@/utils/dynamicImport';
import { limitedDropService } from '@/services/commerce/LimitedDropService';

export const CommerceTools = {
    /**
     * Photorealistic Mockup Generator (Workstream F1 / Directive Part II.6).
     * Physical merch/media staging (vinyl sleeves, CD jewel cases, cassettes, apparel, posters)
     * via locked prompt templates enforcing 1:1 artwork fidelity.
     */
    generate_mockup: wrapTool('generate_mockup', async (args: {
        productType?: string;
        kind?: string;
        designIdea?: string;
        artworkUrl?: string;
        artworkIndex?: number;
        scene?: 'studio' | 'lifestyle' | 'flat';
        aspectRatio?: string;
    }) => {
        let artworkUrl = args.artworkUrl;
        if (!artworkUrl && args.artworkIndex !== undefined) {
            const { useStore } = await importWithRetry(() => import('@/core/store'));
            const store = useStore.getState();
            artworkUrl = store.generatedHistory?.[args.artworkIndex]?.url ?? store.uploadedImages?.[args.artworkIndex]?.url;
        }
        const productType = args.productType || args.kind || 'poster';
        const designIdea = args.designIdea || `Photorealistic mockup of ${productType}`;
        return CommerceTools.mockup_merchandise({
            productType,
            designIdea,
            artworkUrl,
            scene: args.scene,
            aspectRatio: args.aspectRatio
        });
    }),

    mockup_merchandise: wrapTool('mockup_merchandise', async (args: { productType: string; designIdea: string; artworkUrl?: string; scene?: 'studio' | 'lifestyle' | 'flat'; aspectRatio?: string }) => {
        // F1 extension (plan §11): when real artwork is supplied, route through
        // MockupService — the artwork crosses as a sourceImages reference with
        // a fidelity-locked template, never re-described in prose alone.
        // Results become history items (meta 'mockup') + H1 version records.
        if (args.artworkUrl) {
            const kindByProduct: Record<string, string> = {
                't-shirt': 'tee', 'tee': 'tee', 'hoodie': 'hoodie',
                'vinyl': 'vinyl-12', '12-inch vinyl': 'vinyl-12',
                'poster': 'poster', 'cassette': 'cassette', 'cd': 'cd-jewel'
            };
            const kind = kindByProduct[args.productType.toLowerCase()] ?? 'poster';
            const { generateMockup, MOCKUP_PROMPTS } = await importWithRetry(() => import('@/services/mockup/MockupService'));
            if (!(kind in MOCKUP_PROMPTS)) {
                return toolError(`No mockup template for product type "${args.productType}". Supported artwork mockups: tee, hoodie, vinyl, poster, cassette, cd.`, 'INVALID_INPUT');
            }

            try {
                const mockup = await generateMockup({
                    artworkUrl: args.artworkUrl,
                    kind: kind as Parameters<typeof generateMockup>[0]['kind'],
                    scene: args.scene,
                    aspectRatio: args.aspectRatio
                });

                const { useStore } = await importWithRetry(() => import('@/core/store'));
                const store = useStore.getState();
                const historyId = `mockup_${mockup.kind}_${Date.now()}`;
                store.addToHistory({
                    id: historyId,
                    url: mockup.url,
                    prompt: `Mockup: ${mockup.kind}`,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: store.currentProjectId,
                    meta: JSON.stringify({ source: 'mockup', kind: mockup.kind }),
                    tags: ['mockup', mockup.kind],
                    origin: 'generated'
                });

                // H1 producer hook — mockup versions join the asset graph.
                try {
                    const { AssetVersionService } = await importWithRetry(() => import('@/services/assets/AssetVersionService'));
                    await AssetVersionService.recordVersion({
                        assetId: historyId,
                        parentVersionId: null,
                        url: mockup.url,
                        source: 'mockup',
                        provenance: { note: `Mockup ${mockup.kind}` },
                        tags: ['mockup', mockup.kind]
                    });
                } catch (versionError) {
                    logger.warn('[CommerceTools] Version record failed for mockup; result unaffected:', versionError);
                }

                return toolSuccess({
                    productType: args.productType,
                    kind: mockup.kind,
                    artworkFidelity: 'sourceImages reference — artwork not re-described',
                    promptUsed: mockup.promptUsed,
                    mockupImageUrl: mockup.url,
                    readyForPOD: false,
                    reason: 'AI mockup preview only. Requires product variant ID, print-area mapping, DPI verification, and provider file acceptance before upload.',
                }, `Artwork-faithful ${mockup.kind} mockup generated. Visual reference only — not production-ready for upload.`);
            } catch (err: unknown) {
                logger.error('[CommerceTools] artwork mockup generation failed:', err);
                return toolError(`Failed to generate artwork mockup: ${err instanceof Error ? err.message : String(err)}`, 'IMAGE_GEN_FAILED');
            }
        }

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

    deploy_storefront_preview: wrapTool('deploy_storefront_preview', async (args: {
        campaignName: string;
        items: Array<{
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
        }>;
        shippingAllowedCountries?: string[];
        automaticTax?: boolean;
        idempotencyKey?: string;
    }) => {
        try {
            const { functions } = await importWithRetry(() => import('@/services/firebase'));
            const { httpsCallable } = await importWithRetry(() => import('firebase/functions'));
            const createPaymentLinksFn = httpsCallable(functions, 'createStripePaymentLinks');

            const result = await createPaymentLinksFn(args) as { data: {
                checkoutPreviewUrl: string;
                checkoutItems: Array<{ sku: string; priceId: string }>;
                fulfillmentReady: false;
                inventoryEnforced: false;
                note: string;
            } };
            return toolSuccess(
                result.data,
                `Itemized Stripe checkout preview created for "${args.campaignName}" with ${result.data.checkoutItems.length} priced items. It is not a deployed storefront; inventory and fulfillment remain unconnected.`,
            );
        } catch (_err: unknown) {
            logger.warn('[CommerceTools] createStripePaymentLinks not available');
            return toolError(
                'Could not create the Stripe checkout preview. Every item needs a real SKU, price, currency, quantity, stock level, shipping setting, and fulfillment provider.',
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
    generate_mockup,
    deploy_storefront_preview,
    recommend_merch_pricing,
    create_limited_drop_campaign
} = CommerceTools;
