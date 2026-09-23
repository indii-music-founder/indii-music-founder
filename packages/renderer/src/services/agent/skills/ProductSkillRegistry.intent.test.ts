/**
 * Async skill-intent fallback tests (ISSUE-1442 TypeSafe pilot).
 * Deterministic matchers stay primary; the Jev Choice only fires on a total
 * miss with the enable_typesafe_judgments flag on.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    httpsCallable: vi.fn(),
    enabled: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: (_fns: unknown, name: string) => mocks.httpsCallable(name),
}));

vi.mock('@/config/featureFlags', () => ({
    featureFlags: { isEnabled: mocks.enabled },
    FEATURE_FLAG_NAMES: { TYPESAFE_JUDGMENTS: 'enable_typesafe_judgments' },
}));

import { ProductSkillRegistry, parseSkillDocument } from './ProductSkillRegistry';

const RAW_SKILL = `---
name: digital_distribution
description: DSP ingestion, DDEX standards, and ISRC allocation.
trigger_labels:
  - dsp
  - distribution
---

# Digital Distribution
Playbook body.
`;

describe('searchProductSkillByIntentAsync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ProductSkillRegistry.registerSkill(parseSkillDocument('digital_distribution', RAW_SKILL));
    });

    it('mirrors the deterministic result without calling the judgment when it matches', async () => {
        mocks.enabled.mockReturnValue(true);

        const skill = await ProductSkillRegistry.searchProductSkillByIntentAsync('/digital_distribution');

        expect(skill?.id).toBe('digital_distribution');
        expect(mocks.httpsCallable).not.toHaveBeenCalled();
    });

    it('falls back to the Jev Choice on a deterministic miss and adopts the picked skill', async () => {
        mocks.enabled.mockReturnValue(true);
        mocks.httpsCallable.mockImplementation((name: unknown) => {
            expect(name).toBe('typesafeJudge');
            return async () => ({ data: { answers: { skill: { choice: 'digital_distribution' } } } });
        });

        // 'xyzzy plugh' matches no bundled skill's name/id/description, so the
        // deterministic stages must miss against the FULL catalog in CI too.
        const skill = await ProductSkillRegistry.searchProductSkillByIntentAsync('xyzzy plugh');

        expect(skill?.id).toBe('digital_distribution');
    });

    it('stays undefined on a miss when the flag is off', async () => {
        mocks.enabled.mockReturnValue(false);

        const skill = await ProductSkillRegistry.searchProductSkillByIntentAsync('zzz unrelated qqq');

        expect(skill).toBeUndefined();
        expect(mocks.httpsCallable).not.toHaveBeenCalled();
    });
});
