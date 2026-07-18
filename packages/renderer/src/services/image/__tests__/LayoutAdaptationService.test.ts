import { describe, it, expect, beforeAll } from 'vitest';
import { LayoutAdaptationService, LAYOUT_PRESETS } from '../LayoutAdaptationService';

describe('LayoutAdaptationService', () => {
    beforeAll(() => {
        // Mock the Image constructor for jsdom compatibility
        global.Image = class {
            onload: () => void = () => {};
            onerror: (err: any) => void = () => {};
            src: string = '';
            width: number = 800;
            height: number = 800;
            crossOrigin: string = '';
            constructor() {
                setTimeout(() => this.onload(), 10);
            }
        } as any;
    });

    it('should calculate dimensions and generate outpaint setup correctly for story preset', async () => {
        const result = await LayoutAdaptationService.generateOutpaintSetup(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'story'
        );

        expect(result.paddedImage).toBeDefined();
        expect(result.maskImage).toBeDefined();
        expect(result.dimensions.width).toBe(LAYOUT_PRESETS.story.width);
        expect(result.dimensions.height).toBe(LAYOUT_PRESETS.story.height);
    });

    it('should generate outpaint setup for vinyl preset and invoke draw elements', async () => {
        const result = await LayoutAdaptationService.generateOutpaintSetup(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'vinyl'
        );

        expect(result.dimensions.width).toBe(LAYOUT_PRESETS.vinyl.width);
        expect(result.dimensions.height).toBe(LAYOUT_PRESETS.vinyl.height);
    });
});
