import { describe, it, expect } from 'vitest';
import {
    CampaignStatusSchema,
    ImageAssetSchema,
    ScheduledPostSchema,
    CreatePostRequestSchema
} from './schemas';

describe('Social Schemas', () => {
    describe('CampaignStatusSchema', () => {
        it('should accept valid statuses', () => {
            expect(CampaignStatusSchema.parse('PENDING')).toBe('PENDING');
            expect(CampaignStatusSchema.parse('EXECUTING')).toBe('EXECUTING');
            expect(CampaignStatusSchema.parse('DONE')).toBe('DONE');
            expect(CampaignStatusSchema.parse('FAILED')).toBe('FAILED');
        });

        it('should reject invalid statuses', () => {
            expect(() => CampaignStatusSchema.parse('UNKNOWN')).toThrow();
        });
    });

    describe('ImageAssetSchema', () => {
        it('should validate a valid image asset', () => {
            const data = {
                assetType: 'image',
                title: 'Test Image',
                imageUrl: 'https://example.com/image.jpg',
                caption: 'A test image'
            };
            const result = ImageAssetSchema.parse(data);
            expect(result).toEqual(data);
        });

        it('should require valid url', () => {
            const data = {
                assetType: 'image',
                title: 'Test Image',
                imageUrl: 'not-a-url',
            };
            expect(() => ImageAssetSchema.parse(data)).toThrow();
        });

        it('should enforce assetType "image"', () => {
             const data = {
                assetType: 'video', // Invalid
                title: 'Test Image',
                imageUrl: 'https://example.com/image.jpg',
            };
            expect(() => ImageAssetSchema.parse(data)).toThrow();
        });
    });

    describe('ScheduledPostSchema', () => {
        it('should parse valid post with defaults', () => {
            const data = {
                platform: 'Twitter',
                copy: 'Hello world'
            };
            const result = ScheduledPostSchema.parse(data);
            expect(result.status).toBe('PENDING');
            expect(result.copy).toBe('Hello world');
        });

        it('should transform scheduledTime correctly', () => {
            const now = Date.now();

            // Number
            let result = ScheduledPostSchema.parse({ platform: 'Twitter', copy: 'Hi', scheduledTime: now });
            expect(result.scheduledTime).toBe(now);

            // Date object
            const date = new Date(now);
            result = ScheduledPostSchema.parse({ platform: 'Twitter', copy: 'Hi', scheduledTime: date });
            expect(result.scheduledTime).toBe(now);

            // String
            const str = date.toISOString();
            result = ScheduledPostSchema.parse({ platform: 'Twitter', copy: 'Hi', scheduledTime: str });
            expect(result.scheduledTime).toBe(now); // Note: might have slight precision diff if not handling ms, but ISO string should be fine.
        });

        it('should fail if copy is empty', () => {
             const data = {
                platform: 'Twitter',
                copy: '' // Invalid min(1)
            };
            expect(() => ScheduledPostSchema.parse(data)).toThrow();
        });
    });

    describe('CreatePostRequestSchema', () => {
        it('should validate valid request', () => {
            const data = {
                content: 'New post',
                mediaUrls: ['https://example.com/1.jpg']
            };
            const result = CreatePostRequestSchema.parse(data);
            expect(result.content).toBe('New post');
            expect(result.mediaUrls).toHaveLength(1);
        });

        it('should default mediaUrls to empty array', () => {
             const data = {
                content: 'New post'
            };
            const result = CreatePostRequestSchema.parse(data);
            expect(result.mediaUrls).toEqual([]);
        });
    });
});
