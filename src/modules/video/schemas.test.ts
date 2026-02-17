import { describe, it, expect } from 'vitest';
import {
    VideoJobStatusSchema,
    VideoResolutionSchema,
    VideoAspectRatioSchema,
    VideoGenerationOptionsSchema
} from './schemas';

describe('Video Schemas', () => {
    describe('Enums', () => {
        it('should validate VideoJobStatusSchema', () => {
            expect(VideoJobStatusSchema.parse('idle')).toBe('idle');
            expect(() => VideoJobStatusSchema.parse('invalid')).toThrow();
        });

        it('should validate VideoResolutionSchema', () => {
             expect(VideoResolutionSchema.parse('1920x1080')).toBe('1920x1080');
             expect(() => VideoResolutionSchema.parse('800x600')).toThrow();
        });

        it('should validate VideoAspectRatioSchema', () => {
            expect(VideoAspectRatioSchema.parse('16:9')).toBe('16:9');
            expect(() => VideoAspectRatioSchema.parse('21:9')).toThrow();
        });
    });

    describe('VideoGenerationOptionsSchema', () => {
        it('should require prompt', () => {
            const data = {
                // prompt missing
                duration: 10
            };
            expect(() => VideoGenerationOptionsSchema.parse(data)).toThrow();
        });

        it('should validate duration constraints', () => {
             const base = { prompt: 'Test' };
             expect(VideoGenerationOptionsSchema.parse({ ...base, duration: 1 }).duration).toBe(1);
             expect(VideoGenerationOptionsSchema.parse({ ...base, duration: 300 }).duration).toBe(300);

             expect(() => VideoGenerationOptionsSchema.parse({ ...base, duration: 0 })).toThrow(); // min 1
             expect(() => VideoGenerationOptionsSchema.parse({ ...base, duration: 301 })).toThrow(); // max 300
        });

        it('should validate fps constraints', () => {
             const base = { prompt: 'Test' };
             expect(VideoGenerationOptionsSchema.parse({ ...base, fps: 1 }).fps).toBe(1);
             expect(VideoGenerationOptionsSchema.parse({ ...base, fps: 60 }).fps).toBe(60);

             expect(() => VideoGenerationOptionsSchema.parse({ ...base, fps: 0 })).toThrow();
             expect(() => VideoGenerationOptionsSchema.parse({ ...base, fps: 61 })).toThrow();
        });

        it('should validate ingredients are urls', () => {
             const base = { prompt: 'Test' };
             expect(VideoGenerationOptionsSchema.parse({ ...base, ingredients: ['https://example.com/img.png'] }).ingredients).toHaveLength(1);

             expect(() => VideoGenerationOptionsSchema.parse({ ...base, ingredients: ['not-a-url'] })).toThrow();
        });
    });
});
