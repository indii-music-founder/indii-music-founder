import { describe, expect, it } from 'vitest';
import { GenerateOmniRemixSchema } from './creative';
const baseRequest = {
    prompt: 'A continuous performance shot with a driving electronic soundtrack',
    durationSeconds: 8,
    aspectRatio: '16:9',
};
describe('GenerateOmniRemixSchema', () => {
    it.each([
        ['text_to_video', {}],
        ['image_to_video', { firstFrameUri: 'gs://bucket/creative/user/images/start.png' }],
        ['reference_to_video', { referenceUris: ['gs://bucket/creative/user/images/artist.png'] }],
        ['edit', { referenceVideoUri: 'gs://bucket/creative/user/video/source.mp4' }],
    ])('accepts a valid %s request', (task, inputs) => {
        expect(GenerateOmniRemixSchema.safeParse({ ...baseRequest, task, ...inputs }).success).toBe(true);
    });
    it('requires both provider interaction and owned job IDs for a stateful edit', () => {
        const incomplete = GenerateOmniRemixSchema.safeParse({
            ...baseRequest,
            task: 'edit',
            previousInteractionId: 'interaction-123',
        });
        expect(incomplete.success).toBe(false);
        if (!incomplete.success) {
            expect(incomplete.error.issues).toEqual(expect.arrayContaining([
                expect.objectContaining({ path: ['previousJobId'] }),
            ]));
        }
        expect(GenerateOmniRemixSchema.safeParse({
            ...baseRequest,
            task: 'edit',
            previousInteractionId: 'interaction-123',
            previousJobId: 'job-123',
        }).success).toBe(true);
    });
    it('does not mix a stored interaction with a new uploaded source', () => {
        expect(GenerateOmniRemixSchema.safeParse({
            ...baseRequest,
            task: 'edit',
            previousInteractionId: 'interaction-123',
            previousJobId: 'job-123',
            referenceVideoUri: 'gs://bucket/creative/user/video/source.mp4',
        }).success).toBe(false);
    });
    it('accepts 3–10 second outputs and rejects durations outside that range', () => {
        expect(GenerateOmniRemixSchema.safeParse({ ...baseRequest, task: 'text_to_video', durationSeconds: 3 }).success).toBe(true);
        expect(GenerateOmniRemixSchema.safeParse({ ...baseRequest, task: 'text_to_video', durationSeconds: 10 }).success).toBe(true);
        expect(GenerateOmniRemixSchema.safeParse({ ...baseRequest, task: 'text_to_video', durationSeconds: 2 }).success).toBe(false);
        expect(GenerateOmniRemixSchema.safeParse({ ...baseRequest, task: 'text_to_video', durationSeconds: 11 }).success).toBe(false);
    });
    it('accepts timecoded storyboards only within the output duration', () => {
        expect(GenerateOmniRemixSchema.safeParse({
            ...baseRequest,
            task: 'text_to_video',
            storyboard: [
                { timestamp: 0, prompt: 'Open on the singer.' },
                { timestamp: 6, prompt: 'Cut to a wide crowd shot.' },
            ],
        }).success).toBe(true);
        expect(GenerateOmniRemixSchema.safeParse({
            ...baseRequest,
            task: 'text_to_video',
            storyboard: [{ timestamp: 9, prompt: 'This cue is too late.' }],
        }).success).toBe(false);
    });
    it('rejects media that conflicts with an explicitly selected task', () => {
        expect(GenerateOmniRemixSchema.safeParse({
            ...baseRequest,
            task: 'text_to_video',
            referenceVideoUri: 'gs://bucket/creative/user/video/source.mp4',
        }).success).toBe(false);
        expect(GenerateOmniRemixSchema.safeParse({
            ...baseRequest,
            task: 'text_to_video',
            referenceUris: ['gs://bucket/creative/user/images/reference.png'],
        }).success).toBe(false);
        expect(GenerateOmniRemixSchema.safeParse({
            ...baseRequest,
            task: 'image_to_video',
            referenceUris: ['gs://bucket/creative/user/images/reference.png'],
        }).success).toBe(false);
    });
    it('caps the combined first-frame and reference image count at eight', () => {
        const references = Array.from({ length: 8 }, (_, index) => `gs://bucket/creative/user/images/${index}.png`);
        expect(GenerateOmniRemixSchema.safeParse({
            ...baseRequest,
            task: 'image_to_video',
            firstFrameUri: 'gs://bucket/creative/user/images/first.png',
            referenceUris: references,
        }).success).toBe(false);
    });
});
