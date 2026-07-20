import * as admin from 'firebase-admin';
import { verifyOwnership } from '../helpers.js';
import { IndiiMcpTool, McpContext } from '../types.js';

type BrandAsset = {
    id?: string;
    url: string;
    description?: string;
    category?: string;
    tags?: string[];
    subject?: string;
};

type BrandKit = {
    colors?: string[];
    fonts?: string;
    brandDescription?: string;
    aestheticStyle?: string;
    negativePrompt?: string;
    socials?: Record<string, unknown>;
    brandAssets?: BrandAsset[];
    referenceImages?: BrandAsset[];
    releaseDetails?: Record<string, unknown>;
    visualsAcknowledged?: boolean;
    targetAudience?: string;
    visualIdentity?: string;
    digitalAura?: string[];
    healthHistory?: unknown[];
};

const EMPTY_BRAND_KIT: Required<Pick<BrandKit, 'colors' | 'fonts' | 'brandDescription' | 'negativePrompt' | 'socials' | 'brandAssets' | 'referenceImages' | 'releaseDetails'>> = {
    colors: [],
    fonts: '',
    brandDescription: '',
    negativePrompt: '',
    socials: {},
    brandAssets: [],
    referenceImages: [],
    releaseDetails: {},
};

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error || 'unknown Firestore error');
}

function normalizeBrandKit(rawBrandKit: unknown): BrandKit {
    const brandKit = rawBrandKit && typeof rawBrandKit === 'object' ? rawBrandKit as BrandKit : {};

    return {
        ...EMPTY_BRAND_KIT,
        ...brandKit,
        colors: Array.isArray(brandKit.colors) ? brandKit.colors.filter((color): color is string => typeof color === 'string') : [],
        fonts: typeof brandKit.fonts === 'string' ? brandKit.fonts : '',
        brandDescription: typeof brandKit.brandDescription === 'string' ? brandKit.brandDescription : '',
        negativePrompt: typeof brandKit.negativePrompt === 'string' ? brandKit.negativePrompt : '',
        socials: brandKit.socials && typeof brandKit.socials === 'object' ? brandKit.socials : {},
        brandAssets: Array.isArray(brandKit.brandAssets) ? brandKit.brandAssets : [],
        referenceImages: Array.isArray(brandKit.referenceImages) ? brandKit.referenceImages : [],
        releaseDetails: brandKit.releaseDetails && typeof brandKit.releaseDetails === 'object' ? brandKit.releaseDetails : {},
    };
}

export const fetchBrandKit: IndiiMcpTool = {
    name: 'fetch_brand_kit',
    description: 'Pulls the authenticated artist brand aesthetic data (colors, typography, tone) from their Firestore profile.',
    inputSchema: {
        type: 'object',
        properties: {
            artistId: { type: 'string' },
        },
        required: ['artistId'],
    },
    handler: async (rawArgs: Record<string, unknown>, context: McpContext) => {
        const targetUserId = String(rawArgs.userId || rawArgs.artistId || rawArgs.ownerId || context.user.uid);
        try {
            verifyOwnership(context, targetUserId);
        } catch (error: unknown) {
            return {
                isError: true,
                content: [{ type: 'text', text: errorMessage(error) }],
            };
        }

        try {
            const profileSnap = await admin.firestore().collection('users').doc(targetUserId).get();
            if (!profileSnap.exists) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Brand kit unavailable: user profile ${targetUserId} was not found.` }],
                };
            }

            const profile = profileSnap.data() || {};
            const brandKit = normalizeBrandKit(profile.brandKit);

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        artistId: targetUserId,
                        source: `users/${targetUserId}.brandKit`,
                        brandKit,
                        assetCounts: {
                            brandAssets: brandKit.brandAssets?.length || 0,
                            referenceImages: brandKit.referenceImages?.length || 0,
                        },
                    }, null, 2),
                }],
            };
        } catch (error: unknown) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Brand kit lookup failed: ${errorMessage(error)}` }],
            };
        }
    },
};
