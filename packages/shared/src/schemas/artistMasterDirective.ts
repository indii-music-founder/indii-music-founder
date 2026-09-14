/**
 * packages/shared/src/schemas/artistMasterDirective.ts
 *
 * Tier 0 Artist Master Directive (Living User Skill Protocol) Schema.
 *
 * Defines the co-authored operational playbook that allows both the human artist
 * and the AI Conductor to define and refine user-specific rules, sonic specs,
 * legal red lines, brand aesthetics, and distribution constraints.
 *
 * This living skill has the highest precedence in runtime prompt injection,
 * dynamically overriding the base 27 compile-time Conductor Domain Playbooks.
 */

import { z } from 'zod';

export const DIRECTIVE_SECTION_KEYS = [
    'sonicSpecs',
    'businessLegal',
    'brandingAesthetics',
    'releaseDistribution',
    'customPlaybook'
] as const;

export type DirectiveSectionKey = typeof DIRECTIVE_SECTION_KEYS[number];

export const DirectiveSectionKeySchema = z.enum(DIRECTIVE_SECTION_KEYS);

export const DirectiveSectionSchema = z.object({
    title: z.string().min(1).max(120),
    description: z.string().max(280),
    content: z.string().default(''),
    rules: z.array(z.string().trim().min(1).max(500)).default([]),
    updatedAt: z.string().datetime().optional(),
}).strict();

export type DirectiveSection = z.infer<typeof DirectiveSectionSchema>;

export const ArtistMasterDirectiveSchema = z.object({
    schemaVersion: z.literal('artist-master-directive.v1'),
    artistName: z.string().trim().default('Artist'),
    sections: z.object({
        sonicSpecs: DirectiveSectionSchema,
        businessLegal: DirectiveSectionSchema,
        brandingAesthetics: DirectiveSectionSchema,
        releaseDistribution: DirectiveSectionSchema,
        customPlaybook: DirectiveSectionSchema,
    }),
    customRawMarkdown: z.string().default(''),
    lastModifiedBy: z.enum(['user', 'agent']).default('user'),
    lastModifiedReason: z.string().max(280).optional(),
    updatedAt: z.string().datetime().optional(),
}).strict();

export type ArtistMasterDirective = z.infer<typeof ArtistMasterDirectiveSchema>;

export const DEFAULT_ARTIST_MASTER_DIRECTIVE: ArtistMasterDirective = {
    schemaVersion: 'artist-master-directive.v1',
    artistName: 'Artist',
    sections: {
        sonicSpecs: {
            title: 'Sonic & Mastering Standards',
            description: 'Target loudness (LUFS), sample rates, dynamic range, and stem delivery specs.',
            content: '- Target integrated loudness: -14 LUFS (streaming baseline)\n- True Peak ceiling: -1.0 dBTP\n- Preferred sample rate & bit depth: 48kHz / 24-bit WAV\n- Stem delivery requirement: Dry and wet vocal stems separated',
            rules: [
                'Target integrated loudness: -14 LUFS (streaming baseline)',
                'True Peak ceiling: -1.0 dBTP',
                'Preferred sample rate & bit depth: 48kHz / 24-bit WAV',
                'Stem delivery requirement: Dry and wet vocal stems separated'
            ]
        },
        businessLegal: {
            title: 'Business & Legal Red Lines',
            description: 'Non-negotiable contract terms, split sheet baselines, and audit rights.',
            content: '- Master ownership: Artist retains 100% sound recording copyright (licensing/distribution deals only)\n- Management sunset clauses: Maximum 2 years scaling down post-term\n- Split sheet policy: Never leave a session without executed signatures\n- Sampling policy: All samples and interpolations must be cleared prior to DSP ingestion',
            rules: [
                'Master ownership: Artist retains 100% sound recording copyright (licensing/distribution deals only)',
                'Management sunset clauses: Maximum 2 years scaling down post-term',
                'Split sheet policy: Never leave a session without executed signatures',
                'Sampling policy: All samples and interpolations must be cleared prior to DSP ingestion'
            ]
        },
        brandingAesthetics: {
            title: 'Brand & Aesthetic Identity',
            description: 'Visual palettes, persona posture, messaging tone, and artistic boundaries.',
            content: '- Communication tone: Authentic, direct, culturally grounded\n- Visual style: High-contrast, analog texture, anti-stock imagery\n- Voice policy: No unconsented synthetic voice cloning or unauthorized generative replicas',
            rules: [
                'Communication tone: Authentic, direct, culturally grounded',
                'Visual style: High-contrast, analog texture, anti-stock imagery',
                'Voice policy: No unconsented synthetic voice cloning or unauthorized generative replicas'
            ]
        },
        releaseDistribution: {
            title: 'Release & Distribution Protocol',
            description: 'Platform priorities, editorial pitch lead times, and territorial focus.',
            content: '- Pitch lead time: Minimum 4 weeks prior to release date for DSP editorial submission\n- Primary focus DSPs: Spotify, Apple Music, Tidal, Bandcamp\n- Metadata standard: Strict ISRC matching on re-releases to preserve stream counts\n- Artwork standard: 3000x3000px, RGB, lossless format',
            rules: [
                'Pitch lead time: Minimum 4 weeks prior to release date for DSP editorial submission',
                'Primary focus DSPs: Spotify, Apple Music, Tidal, Bandcamp',
                'Metadata standard: Strict ISRC matching on re-releases to preserve stream counts',
                'Artwork standard: 3000x3000px, RGB, lossless format'
            ]
        },
        customPlaybook: {
            title: 'Custom Freeform Directives',
            description: 'Artist-specific instructions, venue rider preferences, or custom automation triggers.',
            content: '',
            rules: []
        }
    },
    customRawMarkdown: '',
    lastModifiedBy: 'user',
};

/**
 * Compiles an ArtistMasterDirective object into a clean, markdown document.
 */
export function compileDirectiveToMarkdown(directive: ArtistMasterDirective): string {
    const parts: string[] = [
        `# Artist Master Directive: ${directive.artistName}`,
        `*Last modified by ${directive.lastModifiedBy}${directive.lastModifiedReason ? ` (${directive.lastModifiedReason})` : ''}*`,
        ''
    ];

    for (const key of DIRECTIVE_SECTION_KEYS) {
        const section = directive.sections[key];
        if (!section) continue;

        parts.push(`## ${section.title}`);
        parts.push(section.description);
        parts.push('');

        if (section.rules.length > 0) {
            for (const rule of section.rules) {
                parts.push(`- ${rule}`);
            }
            parts.push('');
        } else if (section.content) {
            parts.push(section.content);
            parts.push('');
        }
    }

    if (directive.customRawMarkdown?.trim()) {
        parts.push('## Supplemental Custom Directives');
        parts.push(directive.customRawMarkdown.trim());
        parts.push('');
    }

    return parts.join('\n').trim();
}
