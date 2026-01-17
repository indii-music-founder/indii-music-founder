
import { describe, it, expect } from 'vitest';
import { WhiskService } from './WhiskService';
import { WhiskState } from '@/core/store/slices/creativeSlice';
import { STYLE_PRESETS } from '@/modules/creative/components/whisk/WhiskPresetStyles';

describe('WhiskService Video Support', () => {
    it('should synthesize a video prompt with subject, scene, motion, and style', () => {
        const mockState: WhiskState = {
            subjects: [{
                id: 's1', type: 'text', checked: true, category: 'subject',
                content: 'A futuristic cyborg singer'
            }],
            scenes: [{
                id: 'sc1', type: 'text', checked: true, category: 'scene',
                content: 'Neon lit cyberpunk stage'
            }],
            styles: [{
                id: 'st1', type: 'text', checked: true, category: 'style',
                content: 'Cinematic music video aesthetic'
            }],
            motion: [{
                id: 'm1', type: 'text', checked: true, category: 'motion',
                content: 'Slow motion orbital camera'
            }],
            activePresets: [],
            preciseReference: false,
            targetMedia: 'video',
            generatedHistory: [],
            canvasImages: [],
            uploadedImages: [],
            studioControls: {} as any
        };

        const prompt = WhiskService.synthesizeVideoPrompt('Singing into microphone', mockState);

        // Check for components as implemented in WhiskService
        expect(prompt).toContain('A futuristic cyborg singer');
        expect(prompt).toContain('Neon lit cyberpunk stage');
        expect(prompt).toContain('Cinematic music video aesthetic');
        expect(prompt).toContain('Camera and motion: Slow motion orbital camera');
        expect(prompt).toContain('Cinematic quality');
    });

    it('should extract video parameters from locked presets', async () => {
        // Exact prompt from WhiskPresetStyles for 'Music Video'
        const musicVideoPrompt = 'Cinematic music video aesthetic, dramatic lighting, film grain, 16:9 composition, storytelling mood, professional color grading';

        const mockState: WhiskState = {
            subjects: [],
            scenes: [],
            styles: [{
                id: 'preset-matched',
                type: 'text',
                category: 'style',
                checked: true, // Must be checked to be active
                content: musicVideoPrompt
            }],
            motion: [],
            activePresets: [],
            preciseReference: false,
            targetMedia: 'video',
            generatedHistory: [],
            canvasImages: [],
            uploadedImages: [],
            studioControls: {} as any
        };

        const params = await WhiskService.getVideoParameters(mockState);

        // Music Video preset has these exact values
        expect(params.aspectRatio).toBe('16:9');
        expect(params.duration).toBe(8);
        expect(params.motionIntensity).toBe('high');
    });
});
