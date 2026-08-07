import { describe, it, expect } from 'vitest';
import { PERSONA_FADER_DEFAULT, type PersonaFaderValues } from '@indii/shared';
import { compilePersonaPrompt, PersonaPromptCompilerError } from './PersonaPromptCompiler';

describe('PersonaPromptCompiler', () => {
    it('compiles the population default without throwing', () => {
        expect(() => compilePersonaPrompt(PERSONA_FADER_DEFAULT)).not.toThrow();
    });

    it('rejects invalid fader values instead of silently compiling garbage', () => {
        const invalid = { riskTolerance: 200 } as unknown as PersonaFaderValues;
        expect(() => compilePersonaPrompt(invalid)).toThrow(PersonaPromptCompilerError);
    });

    it('rejects null/undefined', () => {
        expect(() => compilePersonaPrompt(null as unknown as PersonaFaderValues)).toThrow(PersonaPromptCompilerError);
    });

    it('produces materially different output at opposite ends of an axis (the fader must do something)', () => {
        const low = compilePersonaPrompt({ ...PERSONA_FADER_DEFAULT, directness: 0 });
        const high = compilePersonaPrompt({ ...PERSONA_FADER_DEFAULT, directness: 100 });
        expect(low).not.toEqual(high);
        expect(high).toMatch(/blunt/i);
        expect(low).toMatch(/soften/i);
    });

    it('never emits a raw fader number as a standalone instruction — numbers appear only in the trailing reference line', () => {
        const compiled = compilePersonaPrompt({ ...PERSONA_FADER_DEFAULT, brevity: 90 });
        const lines = compiled.split('\n');
        const referenceLine = lines.find((l) => l.startsWith('(reference values:'));
        const instructionLines = lines.filter((l) => l.startsWith('- '));

        expect(referenceLine).toBeDefined();
        // No instruction line (style guidance) should contain a bare "brevity=NN" style token —
        // that number belongs only in the reference line, never in an instruction the model
        // treats as an operative directive.
        for (const line of instructionLines) {
            expect(line).not.toMatch(/brevity\s*[:=]\s*\d+/i);
        }
    });

    it('triggers the brevity/reasoningTransparency reconciliation clause when both are high', () => {
        const compiled = compilePersonaPrompt({
            ...PERSONA_FADER_DEFAULT,
            brevity: 90,
            reasoningTransparency: 90,
        });
        expect(compiled).toMatch(/RECONCILIATION/);
        expect(compiled).toMatch(/Depth without length/);
    });

    it('does not trigger a reconciliation clause when axes do not conflict', () => {
        const compiled = compilePersonaPrompt({
            ...PERSONA_FADER_DEFAULT,
            brevity: 90,
            reasoningTransparency: 10,
        });
        expect(compiled).not.toMatch(/RECONCILIATION/);
    });

    // ── Style/substance isolation (gauntlet criterion 5) ──────────────────
    // This is the first sub-item where the criterion is actually testable:
    // the compiler produces a STYLE block only. It must be structurally
    // incapable of expressing a verdict, risk level, or caveat — there is
    // no verdict input to this function at all, so prove that by contract:
    // the output never contains verdict-shaped language regardless of
    // extreme fader settings, across every axis pushed to its extreme.
    it('style/substance isolation: output never contains verdict-shaped assertions at any fader extreme', () => {
        const verdictLanguage = /\b(you should sign|this deal is (good|bad|safe)|I (recommend|approve|reject) (signing|this offer)|verdict:|risk_level:)\b/i;

        const extremeLow: PersonaFaderValues = {
            riskTolerance: 0,
            brevity: 0,
            directness: 0,
            formality: 0,
            reasoningTransparency: 0,
        };
        const extremeHigh: PersonaFaderValues = {
            riskTolerance: 100,
            brevity: 100,
            directness: 100,
            formality: 100,
            reasoningTransparency: 100,
        };

        expect(compilePersonaPrompt(extremeLow)).not.toMatch(verdictLanguage);
        expect(compilePersonaPrompt(extremeHigh)).not.toMatch(verdictLanguage);
    });

    it('style/substance isolation: the function signature accepts no verdict/content parameter at all', () => {
        // Structural proof, not just a string-matching test: compilePersonaPrompt
        // has exactly one parameter (faderValues). There is no channel through
        // which a caller could pass verdict/substance data into this function,
        // so it cannot leak into style output even if a future edit tried.
        expect(compilePersonaPrompt.length).toBe(1);
    });
});
