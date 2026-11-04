import { describe, expect, it } from 'vitest';
import { THEME_PALETTES } from '@/config/typesafeJudgments';
import { deriveThemeDeterministic } from './DynamicThemeService';

describe('deriveThemeDeterministic', () => {
    it('uses distinct editorial and analog palettes for electronic and retro metadata', () => {
        expect(deriveThemeDeterministic({
            title: 'Pulse', genre: 'Electronic', moodDescriptors: ['bright'],
        })).toEqual(THEME_PALETTES['editorial-cobalt']);
        expect(deriveThemeDeterministic({
            title: 'Tape', genre: 'Retro pop', moodDescriptors: [],
        })).toEqual(THEME_PALETTES['amber-vinyl']);
    });
});
