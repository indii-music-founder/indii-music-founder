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
});
