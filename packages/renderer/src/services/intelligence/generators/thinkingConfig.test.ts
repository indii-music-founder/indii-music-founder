import { describe, expect, it } from 'vitest';
import { normalizeDisabledThinkingConfig } from './thinkingConfig';

describe('disabled thinking configuration', () => {
    it.each([true, false, undefined])('disables summaries for zero budget with preference %s', (includeThoughts) => {
        const result = normalizeDisabledThinkingConfig({
            thinkingConfig: { thinkingBudget: 0, includeThoughts },
        });
        expect(result.thinkingConfig).toEqual({ thinkingBudget: 0, includeThoughts: false });
    });

    it.each([-1, 1024])('preserves enabled or dynamic budget %s and explicit preferences', (thinkingBudget) => {
        for (const includeThoughts of [true, false, undefined]) {
            const config = { thinkingConfig: { thinkingBudget, includeThoughts } };
            expect(normalizeDisabledThinkingConfig(config)).toEqual(config);
        }
    });

    it('preserves level-only settings and absent thinking configuration', () => {
        const config = { thinkingConfig: { thinkingLevel: 'LOW', includeThoughts: true } };
        expect(normalizeDisabledThinkingConfig(config)).toEqual(config);
        expect(normalizeDisabledThinkingConfig({ temperature: 0.2 })).toEqual({ temperature: 0.2 });
    });

    it('preserves merged generation options without mutating caller-owned objects', () => {
        const thinkingConfig = Object.freeze({ thinkingBudget: 0, includeThoughts: true, customOption: 'retained' });
        const responseSchema = { type: 'OBJECT', properties: { title: { type: 'STRING' } } };
        const config = Object.freeze({
            thinkingConfig, responseSchema, responseMimeType: 'application/json',
            temperature: 0.1, maxOutputTokens: 256, systemInstruction: 'Return a title.',
        });
        const result = normalizeDisabledThinkingConfig(config);
        expect(result).toEqual({ ...config, thinkingConfig: { ...thinkingConfig, includeThoughts: false } });
        expect(result.responseSchema).toBe(responseSchema);
        expect(config.thinkingConfig.includeThoughts).toBe(true);
        expect(result).not.toBe(config);
        expect(result.thinkingConfig).not.toBe(thinkingConfig);
    });
});
