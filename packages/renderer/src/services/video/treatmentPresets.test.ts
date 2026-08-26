import { describe, expect, it } from 'vitest';

import { resolveTreatment, resolveTreatmentPreset, VIDEO_TREATMENT_PRESET_IDS } from './treatmentPresets';

describe('treatment presets', () => {
    it('maps direction words to the amber night preset', () => {
        expect(resolveTreatmentPreset('make it feel like an amber night in Detroit')?.id).toBe('amber-night-cinematic');
        expect(resolveTreatmentPreset('dark cinematic moody vibe')?.id).toBe('amber-night-cinematic');
    });

    it('maps tech/studio words to the clean grid preset', () => {
        expect(resolveTreatmentPreset('clean professional studio look')?.id).toBe('clean-grid');
    });

    it('maps drop/release words to the bold arrival preset', () => {
        expect(resolveTreatmentPreset('big bold drop impact')?.id).toBe('bold-arrival');
    });

    it('maps neon/electronic words to the neon night preset', () => {
        expect(resolveTreatmentPreset('synthwave neon club energy')?.id).toBe('neon-night');
    });

    it('maps vinyl/analog words to the vinyl warm preset', () => {
        expect(resolveTreatmentPreset('analog vinyl soul crackle')?.id).toBe('vinyl-warm');
    });

    it('maps cold/precise words to the cold blue preset', () => {
        expect(resolveTreatmentPreset('cold precise winter blue')?.id).toBe('cold-blue');
    });

    it('returns undefined when nothing matches', () => {
        expect(resolveTreatmentPreset('fluffy purple marshmallow')).toBeUndefined();
        expect(resolveTreatmentPreset('')).toBeUndefined();
    });

    it('resolves a preset into concrete project treatment values', () => {
        const treatment = resolveTreatment({ preset: 'amber-night-cinematic' });
        expect(treatment.background).toMatchObject({ kind: 'radial-glow', accent: '#F5B13D' });
        expect(treatment.seam).toEqual({ type: 'cut-the-curve', direction: 'LEFT' });
        expect(treatment.entrance).toBe('waterfall');
        expect(treatment.audioFade).toMatchObject({ inSeconds: 1, outSeconds: 2 });
    });

    it('lets inline overrides win over preset values', () => {
        const treatment = resolveTreatment({
            preset: 'amber-night-cinematic',
            seam: { type: 'cut-the-curve', direction: 'RIGHT' },
            entrance: 'none',
            audioFadeOutSeconds: 3,
        });
        expect(treatment.seam).toEqual({ type: 'cut-the-curve', direction: 'RIGHT' });
        expect(treatment.entrance).toBe('none');
        expect(treatment.audioFade).toMatchObject({ inSeconds: 1, outSeconds: 3 });
    });

    it('resolves a bare inline treatment without a preset', () => {
        const treatment = resolveTreatment({ background: { kind: 'grid' } });
        expect(treatment.background).toEqual({ kind: 'grid' });
        expect(treatment.seam).toBeUndefined();
        expect(treatment.entrance).toBeUndefined();
        expect(treatment.audioFade).toBeUndefined();
    });

    it('exposes every preset id in the picker list', () => {
        expect(VIDEO_TREATMENT_PRESET_IDS).toEqual(
            expect.arrayContaining([
                'amber-night-cinematic',
                'clean-grid',
                'bold-arrival',
                'neon-night',
                'vinyl-warm',
                'cold-blue',
            ]),
        );
    });
});
