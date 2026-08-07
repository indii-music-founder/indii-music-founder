import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERSONA_FADER_AXES, type PersonaFaderValues } from '@indii/shared';

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateStructuredData: vi.fn(),
        generateText: vi.fn(),
    },
}));

import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import {
    getVerdict,
    renderInStyle,
    getPersonaResponse,
    PersonaResponseError,
    type PersonaVerdict,
} from './PersonaResponseService';

const mockGenerateStructuredData = vi.mocked(AutonomousIntelligence.generateStructuredData);
const mockGenerateText = vi.mocked(AutonomousIntelligence.generateText);

const CANARY_VERDICT: PersonaVerdict = {
    verdict: 'This clause caps your royalty rate below industry standard for a first deal.',
    riskLevel: 'high',
    caveats: ['Rate is negotiable pre-signature.', 'Get independent counsel before signing.'],
    escalate: true,
};

const BAND_TEST_POINTS = [0, 25, 50, 75, 100];

function allFaderValuesAt(value: number): PersonaFaderValues {
    return {
        riskTolerance: value,
        brevity: value,
        directness: value,
        formality: value,
        reasoningTransparency: value,
    };
}

describe('PersonaResponseService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getVerdict — substance call', () => {
        it('returns a validated verdict object', async () => {
            mockGenerateStructuredData.mockResolvedValue(CANARY_VERDICT);
            const result = await getVerdict('Should I sign this contract?', 'You are a Contract Reader.');
            expect(result).toEqual(CANARY_VERDICT);
        });

        it('throws PersonaResponseError on a malformed response instead of passing it downstream', async () => {
            mockGenerateStructuredData.mockResolvedValue({ verdict: 'incomplete' });
            await expect(getVerdict('question', 'context')).rejects.toThrow(PersonaResponseError);
        });

        it('throws on missing caveats array', async () => {
            mockGenerateStructuredData.mockResolvedValue({
                verdict: 'x',
                riskLevel: 'low',
                escalate: false,
                // caveats missing
            });
            await expect(getVerdict('question', 'context')).rejects.toThrow(PersonaResponseError);
        });

        it('throws on invalid riskLevel enum value', async () => {
            mockGenerateStructuredData.mockResolvedValue({
                verdict: 'x',
                riskLevel: 'catastrophic', // not in the enum
                caveats: [],
                escalate: false,
            });
            await expect(getVerdict('question', 'context')).rejects.toThrow(PersonaResponseError);
        });

        // ── Style/substance isolation: structural proof ────────────────────
        it('has no parameter through which fader/style data could reach the substance call', () => {
            expect(getVerdict.length).toBe(2); // (question, personaContext) only
        });
    });

    describe('renderInStyle — style call', () => {
        it('never mutates the verdict object it receives', async () => {
            mockGenerateText.mockResolvedValue('some styled prose');
            const verdictCopy = { ...CANARY_VERDICT, caveats: [...CANARY_VERDICT.caveats] };

            await renderInStyle(verdictCopy, allFaderValuesAt(50));

            expect(verdictCopy).toEqual(CANARY_VERDICT);
        });

        it('the prompt sent to the model states the verdict fields are fixed and unchangeable', async () => {
            mockGenerateText.mockResolvedValue('styled output');
            await renderInStyle(CANARY_VERDICT, allFaderValuesAt(50));

            const [promptArg] = mockGenerateText.mock.calls[0]!;
            expect(promptArg).toMatch(/Do NOT change the verdict/);
            expect(promptArg).toContain(CANARY_VERDICT.verdict);
        });
    });

    describe('style/substance isolation — the CI check specified in docs/EVOLAS_BUILD_PLAN.md T1.3', () => {
        it('verdict fields are byte-identical across renders at all 5 band positions on every axis', async () => {
            mockGenerateStructuredData.mockResolvedValue(CANARY_VERDICT);
            mockGenerateText.mockResolvedValue('irrelevant styled prose — not under test here');

            const verdict = await getVerdict('canary question', 'canary persona context');
            const verdictSnapshot = JSON.stringify(verdict);

            for (const axis of PERSONA_FADER_AXES) {
                for (const point of BAND_TEST_POINTS) {
                    const faderValues = { ...allFaderValuesAt(50), [axis]: point } as PersonaFaderValues;
                    await renderInStyle(verdict, faderValues);

                    // The verdict object itself — not the styled prose — must be
                    // byte-identical after every render, regardless of axis or band.
                    expect(JSON.stringify(verdict)).toBe(verdictSnapshot);
                }
            }
        });

        it('getPersonaResponse returns the exact verdict from getVerdict, unaffected by fader values, across a full sweep', async () => {
            mockGenerateStructuredData.mockResolvedValue(CANARY_VERDICT);
            mockGenerateText.mockResolvedValue('styled prose');

            const results = await Promise.all(
                BAND_TEST_POINTS.map((point) =>
                    getPersonaResponse('canary question', 'canary persona context', allFaderValuesAt(point))
                )
            );

            for (const { verdict } of results) {
                expect(verdict).toEqual(CANARY_VERDICT);
            }
        });
    });
});
