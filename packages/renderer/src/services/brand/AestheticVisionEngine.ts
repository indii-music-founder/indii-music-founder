/**
 * AestheticVisionEngine — Gemini structured-output check of an asset against
 * the brand's soft visual identity (docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md,
 * Workstream D / Phase D2). Hard rules (palette ΔE, logo safe zone) live in
 * BrandComplianceService; this engine only judges what pixels can be told:
 * aestheticStyle, visualIdentity, and digitalAura adherence.
 */
import type { BrandKit } from '@/types/User';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import type { Part, Schema } from '@/shared/types/ai.dto';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { toInlineBase64 } from './imagePayload';

export interface AestheticViolationInput {
    detail: string;
    severity: 'error' | 'warning';
}

export interface AestheticAssessment {
    violations: AestheticViolationInput[];
    summary: string;
}

const aestheticSchema: Schema = {
    type: 'object',
    nullable: false,
    properties: {
        violations: {
            type: 'array',
            nullable: false,
            items: {
                type: 'object',
                nullable: false,
                properties: {
                    detail: { type: 'string', nullable: false, description: 'Specific, actionable deviation from the brand identity' },
                    severity: { type: 'string', nullable: false, description: '"error" for clear violations, "warning" for borderline calls' },
                },
                required: ['detail', 'severity'],
            },
        },
        summary: { type: 'string', nullable: false, description: 'One-sentence overall brand-adherence verdict' },
    },
    required: ['violations', 'summary'],
};

/** True when the brand kit declares any soft visual identity or negative brand rules to judge against. */
export function hasAestheticIdentity(brandKit: BrandKit): boolean {
    return Boolean(
        (brandKit.aestheticStyle ?? '').trim() ||
        (brandKit.visualIdentity ?? '').trim() ||
        (brandKit.negativePrompt ?? '').trim() ||
        (brandKit.digitalAura ?? []).some((tag) => tag.trim())
    );
}

function buildPrompt(brandKit: BrandKit): string {
    const identityLines = [
        brandKit.aestheticStyle ? `Aesthetic style: ${brandKit.aestheticStyle}` : null,
        brandKit.visualIdentity ? `Visual identity: ${brandKit.visualIdentity}` : null,
        brandKit.digitalAura?.length ? `Vibe tags: ${brandKit.digitalAura.filter(Boolean).join(', ')}` : null,
        brandKit.brandDescription ? `Brand description: ${brandKit.brandDescription}` : null,
        brandKit.negativePrompt ? `Negative brand rules (FORBIDDEN elements/styles): ${brandKit.negativePrompt}` : null,
    ].filter(Boolean);

    return [
        'You are a strict brand-compliance art director.',
        'Judge ONLY whether this image adheres to the brand visual identity and respects negative brand rules described below.',
        'Do NOT comment on technical quality, palette hex values, or logo placement — other engines cover those.',
        ...identityLines.map((line) => `- ${line}`),
        'Return every deviation with a specific, actionable detail and a severity',
        '("error" = clear violation, "warning" = borderline). Return an empty violations array when fully on-brand.',
    ].join('\n');
}

/**
 * Evaluate the asset against the brand's soft identity. Throws on model or
 * payload failure — the caller decides whether to degrade to a warning.
 */
export async function evaluateAesthetic(assetUrl: string, brandKit: BrandKit): Promise<AestheticAssessment> {
    const { mimeType, data } = await toInlineBase64(assetUrl);
    const parts: Part[] = [
        { text: buildPrompt(brandKit) },
        { inlineData: { mimeType, data } },
    ];

    const result = await AutonomousIntelligence.generateStructuredData<AestheticAssessment>(
        parts,
        aestheticSchema,
        undefined,
        undefined,
        INTELLIGENCE_MODELS.TEXT.FAST
    );

    if (!result || !Array.isArray(result.violations)) {
        throw new Error('Aesthetic engine returned an unreadable verdict.');
    }
    return {
        violations: result.violations
            .filter((v) => v && typeof v.detail === 'string' && v.detail.trim())
            .map((v) => ({ detail: v.detail, severity: v.severity === 'error' ? 'error' : 'warning' })),
        summary: typeof result.summary === 'string' ? result.summary : '',
    };
}
