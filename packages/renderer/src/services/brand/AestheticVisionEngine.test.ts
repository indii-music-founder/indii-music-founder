import { describe, expect, it, vi, beforeEach } from 'vitest';
import { evaluateAesthetic, hasAestheticIdentity } from './AestheticVisionEngine';
import type { BrandKit } from '@/types/User';

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateStructuredData: vi.fn(),
    },
}));

import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

function brandKit(partial: Partial<BrandKit> = {}): BrandKit {
    return {
        colors: [],
        fonts: '',
        brandDescription: '',
        negativePrompt: '',
        socials: {} as BrandKit['socials'],
        brandAssets: [],
        referenceImages: [],
        releaseDetails: {} as BrandKit['releaseDetails'],
        ...partial,
    };
}

describe('hasAestheticIdentity', () => {
    it('is false for an empty brand kit', () => {
        expect(hasAestheticIdentity(brandKit())).toBe(false);
    });

    it.each([
        ['aestheticStyle', { aestheticStyle: 'Cyberpunk' }],
        ['visualIdentity', { visualIdentity: 'Neon-noir, high contrast' }],
        ['digitalAura', { digitalAura: ['Luxury'] }],
    ])('is true when %s is declared', (_field, partial) => {
        expect(hasAestheticIdentity(brandKit(partial))).toBe(true);
    });

    it('ignores whitespace-only identity fields', () => {
        expect(hasAestheticIdentity(brandKit({ aestheticStyle: '  ' }))).toBe(false);
    });
});

describe('evaluateAesthetic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sends the brand identity strings in the vision prompt and returns the verdict', async () => {
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue({
            violations: [{ detail: 'Logo style is serif but brand is geometric sans', severity: 'error' }],
            summary: 'Off-brand typography styling.',
        } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        const assessment = await evaluateAesthetic('data:image/png;base64,AAA', brandKit({
            aestheticStyle: 'Cyberpunk',
            visualIdentity: 'Neon-noir',
            digitalAura: ['Luxury'],
        }));

        const call = vi.mocked(AutonomousIntelligence.generateStructuredData).mock.calls[0]!;
        const promptText = (call[0] as Array<{ text?: string }>)[0]!.text ?? '';
        expect(promptText).toContain('Cyberpunk');
        expect(promptText).toContain('Neon-noir');
        expect(promptText).toContain('Luxury');
        expect(assessment.violations).toHaveLength(1);
        expect(assessment.violations[0]!.severity).toBe('error');
        expect(assessment.summary).toContain('Off-brand');
    });

    it('coerces unknown severities to warning', async () => {
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue({
            violations: [{ detail: 'Borderline call', severity: 'something-else' }],
            summary: '',
        } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);

        const assessment = await evaluateAesthetic('data:image/png;base64,AAA', brandKit({ aestheticStyle: 'Minimal' }));
        expect(assessment.violations[0]!.severity).toBe('warning');
    });

    it('throws when the verdict is unreadable (caller degrades)', async () => {
        vi.mocked(AutonomousIntelligence.generateStructuredData).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateStructuredData>>);
        await expect(
            evaluateAesthetic('data:image/png;base64,AAA', brandKit({ aestheticStyle: 'Minimal' }))
        ).rejects.toThrow('unreadable');
    });
});
