import { describe, expect, it } from 'vitest';
import { buildDirectVideoInputManifest, resolveDirectVideoFirstFrame } from './directVideoInputs';

describe('resolveDirectVideoFirstFrame', () => {
    it('gives the explicit first frame precedence over references', () => {
        expect(resolveDirectVideoFirstFrame('frame-a')).toBe('frame-a');
    });

    it('does not silently promote a reference into a first frame', () => {
        expect(resolveDirectVideoFirstFrame()).toBeUndefined();
    });

    it('keeps distinct A/B/C inputs in their declared outbound roles', () => {
        const result = buildDirectVideoInputManifest({
            explicitFirstFrame: 'gs://assets/A-first-frame.png',
            explicitLastFrame: 'gs://assets/D-last-frame.png',
            ingredients: ['gs://assets/B-ingredient.png'],
            characterReferences: ['gs://assets/C-character.png'],
        });

        expect(result.firstFrame).toBe('gs://assets/A-first-frame.png');
        expect(result.references).toEqual([
            { uri: 'gs://assets/B-ingredient.png', role: 'ingredient' },
            { uri: 'gs://assets/C-character.png', role: 'character_reference' },
        ]);
        expect(result.inputManifest).toEqual([
            { role: 'first_frame', uri: 'gs://assets/A-first-frame.png' },
            { role: 'last_frame', uri: 'gs://assets/D-last-frame.png' },
            { role: 'ingredient', uri: 'gs://assets/B-ingredient.png' },
            { role: 'character_reference', uri: 'gs://assets/C-character.png' },
        ]);
    });
});
