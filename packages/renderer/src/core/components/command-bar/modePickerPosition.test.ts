import { describe, expect, it } from 'vitest';
import { getModePickerPosition } from './modePickerPosition';

describe('getModePickerPosition', () => {
    it('anchors above and to the left of a button inside the viewport', () => {
        expect(getModePickerPosition(
            { top: 700, right: 1100 },
            { width: 1280, height: 800 },
        )).toEqual({ right: 180, bottom: 112 });
    });

    it('keeps the picker onscreen when the docked button rect exceeds the viewport', () => {
        expect(getModePickerPosition(
            { top: 900, right: 1320 },
            { width: 960, height: 720 },
        )).toEqual({ right: 12, bottom: 12 });
    });
});
