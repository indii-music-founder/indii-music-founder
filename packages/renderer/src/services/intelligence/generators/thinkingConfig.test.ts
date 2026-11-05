import { describe, expect, it } from 'vitest';
import { normalizeDisabledThinkingConfig, resolveModelThinkingConfig } from './thinkingConfig';

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


describe('model thinking compatibility', () => {
    it.each(['LOW', 'MEDIUM', 'HIGH'])('preserves explicit Argon level %s and removes legacy budgets', thinkingLevel => {
        expect(resolveModelThinkingConfig('gemini-4-argon', { thinkingLevel, thinkingBudget: 2048, includeThoughts: false }))
            .toEqual({ thinkingLevel, includeThoughts: false });
    });
    it('maps disabled and minimal thinking to the lowest supported Argon level', () => {
        expect(resolveModelThinkingConfig('gemini-4-argon', { thinkingBudget: 0 })).toEqual({ thinkingLevel: 'LOW' });
        expect(resolveModelThinkingConfig('gemini-4-argon', { thinkingLevel: 'minimal' })).toEqual({ thinkingLevel: 'LOW' });
    });
    it('uses the provider default for other legacy budgets without mutating the input', () => {
        const input = Object.freeze({ thinkingBudget: -1, includeThoughts: true });
        expect(resolveModelThinkingConfig('gemini-4-argon', input)).toEqual({ includeThoughts: true });
        expect(input.thinkingBudget).toBe(-1);
    });
    it('retains Gemini 3 budgets and omits settings for unsupported models', () => {
        const input = { thinkingBudget: 1024 };
        expect(resolveModelThinkingConfig('gemini-3.8-flash', input)).toBe(input);
        expect(resolveModelThinkingConfig('other-model', input)).toBeUndefined();
        expect(resolveModelThinkingConfig('gemini-4-argon', null)).toBeUndefined();
    });
});
