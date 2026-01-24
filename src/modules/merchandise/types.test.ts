import { describe, it, expect } from 'vitest';
import {
    MockupGenerationSchema,
    VideoGenerationSchema
} from './types';

describe('Merchandise Schemas', () => {
    describe('MockupGenerationSchema', () => {
        it('should validate valid mockup request', () => {
            const data = {
                userId: 'user1',
                asset: 'image.png',
                type: 'T-Shirt',
                scene: 'Studio',
                status: 'processing',
                createdAt: Date.now()
            };
            const result = MockupGenerationSchema.parse(data);
            expect(result.status).toBe('processing');
        });

        it('should validate status enum', () => {
            const base = {
                userId: 'user1',
                asset: 'image.png',
                type: 'T-Shirt',
                scene: 'Studio',
                createdAt: Date.now()
            };
            expect(() => MockupGenerationSchema.parse({ ...base, status: 'unknown' })).toThrow();
        });
    });

    describe('VideoGenerationSchema', () => {
        it('should validate video generation request', () => {
            const data = {
                userId: 'user1',
                mockupUrl: 'https://example.com/mockup.png',
                motion: 'Pan',
                status: 'queued',
                createdAt: Date.now()
            };
            const result = VideoGenerationSchema.parse(data);
            expect(result.status).toBe('queued');
        });

        it('should require valid mockup url', () => {
            const data = {
                userId: 'user1',
                mockupUrl: 'not-a-url',
                motion: 'Pan',
                status: 'queued',
                createdAt: Date.now()
            };
            expect(() => VideoGenerationSchema.parse(data)).toThrow();
        });
    });
});
