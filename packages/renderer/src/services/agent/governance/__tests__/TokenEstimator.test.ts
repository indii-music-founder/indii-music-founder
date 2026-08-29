import { describe, it, expect, vi } from 'vitest';
import { TokenEstimator } from '../TokenEstimator';
import type { Content } from '@/shared/types/ai.dto';

const NO_TOOLS: never[] = [];

function parts(...ps: Record<string, unknown>[]): Content[] {
    return [{ role: 'user', parts: ps as Content['parts'] }];
}

describe('TokenEstimator', () => {
    it('estimates text prompts at ~4 chars per token', () => {
        const est = TokenEstimator.estimate('a'.repeat(400), undefined, NO_TOOLS, 100_000, 0);
        expect(est.inputTokens).toBe(100);
        expect(est.totalProjected).toBe(100);
        expect(est.willExceed).toBe(false);
    });

    it('counts system instruction and tools', () => {
        const est = TokenEstimator.estimate('hi', 'sys '.repeat(10), [
            { name: 'tool_a', description: 'd'.repeat(40), parameters: undefined }
        ], 100_000, 0);
        // system: 40/4 = 10; prompt: ceil(2/4) = 1; tool: 15 base + ceil(46/4) = 12
        expect(est.inputTokens).toBe(10 + 1 + 15 + 12);
    });

    it('charges the intrinsic 258-token floor for a small inline image', () => {
        const est = TokenEstimator.estimate(
            parts({ inlineData: { mimeType: 'image/png', data: 'c'.repeat(400) } }),
            undefined, NO_TOOLS, 100_000, 0
        );
        // JSON(part) ≈ 400 data + ~50 envelope chars → ~113 < 258 → floor wins
        expect(est.inputTokens).toBe(258);
    });

    it('scales with real base64 size for a large inline image (no more flat 258)', () => {
        const bigData = 'd'.repeat(400_000); // ~400KB binary ≈ 100K+ tokens
        const est = TokenEstimator.estimate(
            parts({ inlineData: { mimeType: 'image/png', data: bigData } }),
            undefined, NO_TOOLS, 1_000_000, 0
        );
        expect(est.inputTokens).toBeGreaterThan(258);
        expect(est.inputTokens).toBeGreaterThan(90_000);
    });

    it('flags willExceed when the projection crosses the remaining budget', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const est = TokenEstimator.estimate('e'.repeat(4000), undefined, NO_TOOLS, 500, 200);
        expect(est.willExceed).toBe(true); // 1000 + 200 > 500
        warn.mockRestore();
    });

    it('handles functionCall and functionResponse parts', () => {
        const est = TokenEstimator.estimate(
            parts(
                { functionCall: { name: 'x', args: {} } },
                { functionResponse: { name: 'x', response: { text: 'f'.repeat(100) } } }
            ),
            undefined, NO_TOOLS, 100_000, 0
        );
        // call: 20 flat; response: ceil(JSON.stringify(part).length / 4)
        const respPart = { functionResponse: { name: 'x', response: { text: 'f'.repeat(100) } } };
        expect(est.inputTokens).toBe(20 + Math.ceil(JSON.stringify(respPart).length / 4));
    });
});
