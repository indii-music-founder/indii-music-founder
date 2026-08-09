import { describe, expect, it, vi } from 'vitest';
import { PERSONA_FADER_DEFAULT, type PersonaFaderValues } from '@indii/shared';
import type { InstrumentedPersonaResponseResult } from './PersonaResponseService';
import { finalizePersonaAgentResponse } from './PersonaAgentResponseService';

const USER_FADERS: PersonaFaderValues = {
    riskTolerance: 10,
    brevity: 20,
    directness: 30,
    formality: 40,
    reasoningTransparency: 80,
};

describe('PersonaAgentResponseService', () => {
    it('maps a completed specialist answer into the instrumented PersonaResponseService contract', async () => {
        const loadFaders = vi.fn().mockResolvedValue(USER_FADERS);
        const getResponse = vi.fn().mockResolvedValue({
            verdict: { verdict: 'Keep the termination right.', riskLevel: 'high', caveats: [], escalate: true },
            styledResponse: 'Styled Contract Reader answer',
            tracking: {
                responseId: 'response-123',
                isControlGroup: false,
                effectiveFaderValues: USER_FADERS,
                measurementRecorded: Promise.resolve(true),
                recordInteraction: vi.fn(),
            },
        } satisfies InstrumentedPersonaResponseResult);

        const result = await finalizePersonaAgentResponse({
            agentId: 'legal',
            question: 'Should I sign?',
            responseId: 'response-123',
            response: { text: 'Keep the termination right and obtain independent review.', toolCalls: [] },
        }, {
            loadFaders,
            getResponse: getResponse as never,
        });

        expect(loadFaders).toHaveBeenCalledWith('contractReader');
        expect(getResponse).toHaveBeenCalledWith(
            expect.stringContaining('Should I sign?'),
            expect.stringContaining('Contract Reader substance stage'),
            USER_FADERS,
            { personaId: 'contractReader', responseId: 'response-123' },
        );
        expect(getResponse.mock.calls[0]?.[0]).toContain('Keep the termination right');
        expect(result).toEqual({
            text: 'Styled Contract Reader answer',
            tracking: {
                personaId: 'contractReader',
                responseId: 'response-123',
                isControlGroup: false,
                effectiveFaderValues: USER_FADERS,
                measurementStatus: 'pending',
            },
            measurementRecorded: expect.any(Promise),
        });
    });

    it('keeps tool-bearing responses byte-identical and never enters the presentation layer', async () => {
        const loadFaders = vi.fn();
        const getResponse = vi.fn();
        const toolResponse = '[Tool: export_release]{"success":true}[End Tool export_release]';

        const result = await finalizePersonaAgentResponse({
            agentId: 'distribution',
            question: 'Export this release.',
            responseId: 'response-tool',
            response: {
                text: toolResponse,
                toolCalls: [{ name: 'export_release', args: {}, result: 'done' }],
            },
        }, { loadFaders, getResponse: getResponse as never });

        expect(result).toEqual({ text: toolResponse });
        expect(loadFaders).not.toHaveBeenCalled();
        expect(getResponse).not.toHaveBeenCalled();
    });

    it('returns the completed specialist answer when fader resolution fails', async () => {
        const result = await finalizePersonaAgentResponse({
            agentId: 'finance',
            question: 'Can I afford this?',
            responseId: 'response-fallback',
            response: { text: 'The current budget has a $500 shortfall.' },
        }, {
            loadFaders: vi.fn().mockRejectedValue(new Error('offline')),
            getResponse: vi.fn() as never,
        });

        expect(result).toEqual({ text: 'The current budget has a $500 shortfall.' });
    });

    it('leaves unmapped agents unchanged without loading faders', async () => {
        const loadFaders = vi.fn().mockResolvedValue(PERSONA_FADER_DEFAULT);

        const result = await finalizePersonaAgentResponse({
            agentId: 'video',
            question: 'Make a video.',
            responseId: 'response-video',
            response: { text: 'Video guidance.' },
        }, { loadFaders, getResponse: vi.fn() as never });

        expect(result).toEqual({ text: 'Video guidance.' });
        expect(loadFaders).not.toHaveBeenCalled();
    });
});
