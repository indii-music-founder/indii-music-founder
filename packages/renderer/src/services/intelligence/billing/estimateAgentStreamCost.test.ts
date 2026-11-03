import { describe, expect, it } from 'vitest';
import { estimateAgentStreamCost } from './estimateAgentStreamCost';

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
        const serverEnvelope = JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            tools: [],
        });
        const serverFloor = Math.max(0.001, Math.ceil(((Math.ceil(serverEnvelope.length / 4) * 1.25 + 10) / 1_000_000) * 100_000) / 100_000);
        expect(client).toBeGreaterThanOrEqual(serverFloor);
    });
});
