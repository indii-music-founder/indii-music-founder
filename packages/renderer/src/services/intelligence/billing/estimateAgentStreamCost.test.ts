import { describe, expect, it } from 'vitest';
import { estimateAgentStreamCost } from './estimateAgentStreamCost';

import { minimumTextStreamReservationCost } from '../../../../../firebase/src/functions/creative/textStreamAdmission';

describe('estimateAgentStreamCost', () => {
    it('reserves more for long prompts and larger output limits', () => {
        const short = estimateAgentStreamCost('hello', undefined, [], 'gemini-3.1-pro-preview', 1_024);
        const long = estimateAgentStreamCost('x'.repeat(400_000), undefined, [], 'gemini-3.1-pro-preview', 8_192);
        expect(long).toBeGreaterThan(short);
        expect(long).toBeGreaterThan(0.001);
    });

    it('uses the conservative rate for an endpoint without a pricing entry', () => {
        const endpoint = estimateAgentStreamCost('prompt', undefined, [], 'projects/p/locations/l/endpoints/e', 8_192);
        const pro = estimateAgentStreamCost('prompt', undefined, [], 'gemini-3.1-pro-preview', 8_192);
        expect(endpoint).toBe(pro);
    });

    it('includes system instructions and tool schemas', () => {
        const plain = estimateAgentStreamCost('prompt', undefined, [], 'gemini-3.1-pro-preview', 1);
        const expanded = estimateAgentStreamCost('prompt', 'x'.repeat(40_000), [{ schema: 'x'.repeat(40_000) }], 'gemini-3.1-pro-preview', 1);
        expect(expanded).toBeGreaterThan(plain);
    });

    it('prices the backend contents envelope at rounding boundaries', () => {
        const prompt = 'x'.repeat(3_117);
        const client = estimateAgentStreamCost(prompt, undefined, [], 'gemini-3.1-pro-preview', 1);
        const contents = [{ role: 'user', parts: [{ text: prompt }] }];
        const serverFloor = minimumTextStreamReservationCost(
            contents, { tools: [], maxOutputTokens: 1 }, 'gemini-3.1-pro-preview',
        );
        expect(client).toBeGreaterThanOrEqual(serverFloor);
    });

    it.each(['gemini-3.1-pro-preview', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'])(
        'covers the server floor for prepared %s requests with thought signatures',
        model => {
            const contents = [{ role: 'user', parts: [{ text: 'hello', thoughtSignature: 'x'.repeat(16_384) }] }];
            const config = { systemInstruction: 'Reply briefly', tools: [], maxOutputTokens: 1_024 };
            expect(estimateAgentStreamCost(contents, config.systemInstruction, config.tools, model, config.maxOutputTokens))
                .toBeGreaterThanOrEqual(minimumTextStreamReservationCost(contents, config, model));
        },
    );
});
