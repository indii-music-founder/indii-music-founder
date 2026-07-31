import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { logger } from '@/utils/logger';
import type { JSONSchemaObject } from '@/services/agent/instruments/InstrumentTypes';
import type { BrandKit } from '@/types/User';

/**
 * BrandVisionQC — Layer 2 (Orchestration) guardrail.
 *
 * The last gate before an AI-generated creative becomes a paid ad. Generation
 * drifts: a model asked for the artist's palette often returns something
 * merely adjacent to it, and once that creative is live on Meta the artist is
 * paying to show off-brand work to strangers.
 *
 * So this runs a vision model against the artist's own Brand Kit and returns a
 * hard approve/reject. It sits *between* creative generation and
 * `pushAdCreative` — never after the spend has started.
 *
 * Sibling to `VisualOutputAutorater`, which asks a different question: that one
 * scores an image against the prompt that produced it, this one against the
 * artist's brand regardless of prompt. Both can reject the same image for
 * different reasons, and both should run.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * The brand constraints the QC evaluates against — a flattened projection of
 * the stored `BrandKit`. Kept separate so callers can QC against an ad-hoc
 * brief (a one-off campaign look) without a full BrandKit on hand.
 */
export interface CreativeBrandKit {
    /** Hex or named colors the creative should be built around. */
    primaryColors: string[];
    /** Things that must never appear — the artist's hard no's. */
    forbiddenElements: string[];
    /** Overall mood/aesthetic in the artist's own words. */
    vibe: string;
}

export interface VisionCheckResult {
    approved: boolean;
    /** Why — surfaced to the artist in the agent log when a creative is rejected. */
    reason: string;
}

// ============================================================================
// Constants
// ============================================================================

const RESULT_SCHEMA: JSONSchemaObject = {
    type: 'object',
    properties: {
        approved: {
            type: 'boolean',
            description: 'True only if the creative is safe to run as a paid ad for this artist.',
        },
        reason: {
            type: 'string',
            description: 'One or two sentences explaining the decision, naming the specific element or color that drove it.',
        },
    },
    required: ['approved', 'reason'],
};

/**
 * Complex reasoning tier. Brand conformance is a judgment call over a palette,
 * a mood, and an exclusion list at once — the fast tier reliably waves through
 * creatives that are only approximately on-brand.
 */
const QC_MODEL = INTELLIGENCE_MODELS.TEXT.AGENT;

// ============================================================================
// Public API
// ============================================================================

/**
 * Projects a stored `BrandKit` onto the QC's input contract.
 *
 * `negativePrompt` is the artist's exclusion list as free text; it is split on
 * commas and newlines into discrete forbidden elements. The vibe falls back
 * through the increasingly general fields the onboarding flow may have filled.
 */
export function toCreativeBrandKit(brandKit: BrandKit): CreativeBrandKit {
    const forbiddenElements = (brandKit.negativePrompt ?? '')
        .split(/[,\n]/)
        .map(entry => entry.trim())
        .filter(entry => entry.length > 0);

    const vibe = [
        brandKit.visualIdentity,
        brandKit.aestheticStyle,
        ...(brandKit.digitalAura ?? []),
        brandKit.brandDescription,
    ].filter((part): part is string => Boolean(part && part.trim())).join(' — ');

    return {
        primaryColors: brandKit.colors ?? [],
        forbiddenElements,
        vibe: vibe || 'No stated visual identity.',
    };
}

/**
 * Evaluates a generated image against the artist's Brand Kit.
 *
 * Fails closed: any error — model failure, malformed response, missing brand
 * data — returns `approved: false`. A creative that could not be checked must
 * not reach a live ad account, and the cost of a false rejection is one
 * regeneration versus paid impressions of off-brand work.
 *
 * @param base64Image Image bytes, with or without a `data:` URL prefix.
 * @param brandKit    Constraints to evaluate against.
 * @param mimeType    Defaults to `image/jpeg`.
 */
export async function runCreativeVisionCheck(
    base64Image: string,
    brandKit: CreativeBrandKit,
    mimeType: string = 'image/jpeg',
): Promise<VisionCheckResult> {
    if (!base64Image) {
        return { approved: false, reason: 'No image was supplied for brand review.' };
    }

    // A kit with nothing in it cannot express a standard, and an unconditional
    // approval here would make the guardrail look like it ran when it did not.
    const hasConstraints =
        brandKit.primaryColors.length > 0 ||
        brandKit.forbiddenElements.length > 0 ||
        brandKit.vibe.trim().length > 0;
    if (!hasConstraints) {
        return {
            approved: false,
            reason: 'No Brand Kit is configured, so this creative cannot be checked for brand fit. Add colors, a vibe, or exclusions in Brand Manager.',
        };
    }

    try {
        const base64Data = base64Image.includes('base64,')
            ? base64Image.split('base64,')[1]
            : base64Image;

        const parts = [
            { text: buildPrompt(brandKit) },
            { inlineData: { data: base64Data, mimeType } },
        ];

        const result = await AutonomousIntelligence.generateStructuredData<VisionCheckResult>(
            parts,
            RESULT_SCHEMA as unknown as Record<string, unknown>,
            undefined,
            undefined,
            QC_MODEL,
        );

        // Structured output is schema-constrained but not schema-guaranteed;
        // a partial object must not read as an approval.
        if (!result || typeof result.approved !== 'boolean') {
            logger.warn('[BrandVisionQC] Model returned no usable verdict; rejecting.');
            return { approved: false, reason: 'Brand review returned an unreadable verdict.' };
        }

        return {
            approved: result.approved,
            reason: result.reason?.trim() || (result.approved ? 'On brand.' : 'Off brand.'),
        };
    } catch (error) {
        logger.error('[BrandVisionQC] Vision QC failed:', error);
        return { approved: false, reason: 'Brand review could not be completed, so the creative was held back.' };
    }
}

// ============================================================================
// Helpers
// ============================================================================

function buildPrompt(brandKit: CreativeBrandKit): string {
    const colors = brandKit.primaryColors.length > 0
        ? brandKit.primaryColors.join(', ')
        : 'none specified';
    const forbidden = brandKit.forbiddenElements.length > 0
        ? brandKit.forbiddenElements.join(', ')
        : 'none specified';

    return `
You are the Creative Director for an independent music artist. This image is about
to be published as a PAID advertisement using the artist's own money. Review it
against their Brand Kit and decide whether it runs.

BRAND KIT
- Primary colors: ${colors}
- Forbidden elements: ${forbidden}
- Overall vibe: ${brandKit.vibe}

Judge three things:
1. Does any forbidden element appear? Any at all is an automatic rejection.
2. Is the image built around the primary colors, rather than merely containing them somewhere?
3. Does the mood match the stated vibe?

Approve only if all three hold. Be strict — an off-brand ad costs the artist money
and dilutes their identity, while a rejection costs one regeneration. When in doubt,
reject.

In the reason, name the specific element or color that drove your decision. Do not
describe the image in general terms.
`.trim();
}
