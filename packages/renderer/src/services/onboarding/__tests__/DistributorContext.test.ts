import { describe, it, expect } from 'vitest';
import {
    buildDistributorContext,
    getImageConstraints,
    getVideoConstraints,
    getAudioConstraints,
    validateImageForDistributor,
    getDistributorPromptContext,
    getRecommendedCanvasSize
} from '../DistributorContext';
import type { UserProfile } from '@/modules/workflow/types';

// Helper to create mock profile with distributor
const createProfile = (distributor?: string): UserProfile => ({
    uid: 'test-user',
    email: 'test@example.com',
    brandKit: distributor ? {
        socials: { distributor }
    } : undefined
} as UserProfile);

describe('DistributorContext', () => {
    describe('buildDistributorContext', () => {
        it('returns defaults when no distributor configured', () => {
            const ctx = buildDistributorContext(createProfile());

            expect(ctx.isConfigured).toBe(false);
            expect(ctx.distributor).toBeNull();
            expect(ctx.image.width).toBe(3000);
            expect(ctx.image.height).toBe(3000);
            expect(ctx.summary).toContain('No distributor configured');
        });

        it('parses DistroKid requirements correctly', () => {
            const ctx = buildDistributorContext(createProfile('distrokid'));

            expect(ctx.isConfigured).toBe(true);
            expect(ctx.distributor?.name).toBe('DistroKid');
            expect(ctx.image.minWidth).toBe(3000);
            expect(ctx.image.minHeight).toBe(3000);
            expect(ctx.image.format).toContain('JPG');
            expect(ctx.video.canvas).toBeDefined();
            expect(ctx.video.canvas?.aspectRatio).toBe('9:16');
        });

        it('parses TuneCore requirements correctly', () => {
            const ctx = buildDistributorContext(createProfile('tunecore'));

            expect(ctx.isConfigured).toBe(true);
            expect(ctx.distributor?.name).toBe('TuneCore');
            expect(ctx.image.minWidth).toBe(3000);
            expect(ctx.video.canvas?.aspectRatio).toBe('9:16');
        });

        it('parses CD Baby requirements correctly (no Canvas)', () => {
            const ctx = buildDistributorContext(createProfile('cdbaby'));

            expect(ctx.isConfigured).toBe(true);
            expect(ctx.distributor?.name).toBe('CD Baby');
            // CD Baby has music video support but no Canvas
            expect(ctx.video.canvas).toBeUndefined();
            expect(ctx.video.musicVideo).toBeDefined();
        });

        it('parses AWAL requirements correctly (no Canvas)', () => {
            const ctx = buildDistributorContext(createProfile('awal'));

            expect(ctx.isConfigured).toBe(true);
            expect(ctx.distributor?.name).toBe('AWAL');
            // AWAL has musicVideo but no Canvas
            expect(ctx.video.canvas).toBeUndefined();
            expect(ctx.video.musicVideo).toBeDefined();
        });

        it('parses Ditto requirements correctly (no Canvas)', () => {
            const ctx = buildDistributorContext(createProfile('ditto'));

            expect(ctx.isConfigured).toBe(true);
            expect(ctx.distributor?.name).toBe('Ditto Music');
            // Ditto has basic video but no Canvas
            expect(ctx.video.canvas).toBeUndefined();
        });

        it('parses UnitedMasters requirements correctly (no Canvas)', () => {
            const ctx = buildDistributorContext(createProfile('unitedmasters'));

            expect(ctx.isConfigured).toBe(true);
            expect(ctx.distributor?.name).toBe('UnitedMasters');
            // UnitedMasters focuses on short-form but no Canvas spec
            expect(ctx.video.canvas).toBeUndefined();
        });

        it('parses Amuse requirements correctly (no Canvas)', () => {
            const ctx = buildDistributorContext(createProfile('amuse'));

            expect(ctx.isConfigured).toBe(true);
            expect(ctx.distributor?.name).toBe('Amuse');
            // Amuse has basic video but no Canvas spec
            expect(ctx.video.canvas).toBeUndefined();
        });

        it('handles unknown distributor names gracefully', () => {
            const ctx = buildDistributorContext(createProfile('unknown_distributor'));

            expect(ctx.isConfigured).toBe(false);
            expect(ctx.distributor).toBeNull();
            expect(ctx.summary).toContain('not recognized');
        });

        it('handles fuzzy matching for distributor names', () => {
            // "distro" should match "distrokid"
            const ctx = buildDistributorContext(createProfile('distro'));

            expect(ctx.isConfigured).toBe(true);
            expect(ctx.distributor?.name).toBe('DistroKid');
        });
    });

    describe('getImageConstraints', () => {
        it('returns 3000x3000 for DistroKid', () => {
            const constraints = getImageConstraints(createProfile('distrokid'));

            expect(constraints.width).toBe(3000);
            expect(constraints.height).toBe(3000);
            expect(constraints.aspectRatio).toBe('1:1');
        });

        it('returns 3000x3000 for TuneCore', () => {
            const constraints = getImageConstraints(createProfile('tunecore'));

            expect(constraints.width).toBe(3000);
            expect(constraints.height).toBe(3000);
        });

        it('returns industry defaults when no distributor', () => {
            const constraints = getImageConstraints(createProfile());

            expect(constraints.width).toBe(3000);
            expect(constraints.height).toBe(3000);
            expect(constraints.notes).toContain('No distributor configured - using industry standard 3000x3000');
        });
    });

    describe('getVideoConstraints', () => {
        it('returns Canvas specs for DistroKid', () => {
            const constraints = getVideoConstraints(createProfile('distrokid'));

            expect(constraints.canvas).toBeDefined();
            expect(constraints.canvas?.aspectRatio).toBe('9:16');
            expect(constraints.canvas?.minDuration).toBeGreaterThan(0);
            expect(constraints.canvas?.maxDuration).toBeGreaterThan(0);
        });

        it('returns Canvas specs for TuneCore', () => {
            const constraints = getVideoConstraints(createProfile('tunecore'));

            expect(constraints.canvas).toBeDefined();
            expect(constraints.canvas?.aspectRatio).toBe('9:16');
        });

        it('returns undefined Canvas for CD Baby', () => {
            const constraints = getVideoConstraints(createProfile('cdbaby'));

            expect(constraints.canvas).toBeUndefined();
            expect(constraints.musicVideo).toBeDefined();
        });

        it('returns undefined Canvas for Ditto', () => {
            const constraints = getVideoConstraints(createProfile('ditto'));

            expect(constraints.canvas).toBeUndefined();
        });

        it('returns default formats when no distributor', () => {
            const constraints = getVideoConstraints(createProfile());

            expect(constraints.formats).toContain('MP4');
            expect(constraints.formats).toContain('MOV');
            expect(constraints.canvas).toBeUndefined();
        });
    });

    describe('getAudioConstraints', () => {
        it('returns WAV/FLAC for DistroKid', () => {
            const constraints = getAudioConstraints(createProfile('distrokid'));

            expect(constraints.format).toContain('WAV');
            expect(constraints.format).toContain('FLAC');
            expect(constraints.sampleRate).toContain(44100);
        });

        it('returns defaults when no distributor', () => {
            const constraints = getAudioConstraints(createProfile());

            expect(constraints.format).toContain('WAV');
            expect(constraints.format).toContain('FLAC');
            expect(constraints.channels).toBe('stereo');
        });
    });

    describe('validateImageForDistributor', () => {
        it('returns valid for 3000x3000 square image', () => {
            const result = validateImageForDistributor(createProfile('distrokid'), 3000, 3000);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('returns error for non-square image', () => {
            const result = validateImageForDistributor(createProfile('distrokid'), 3000, 2000);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('square'))).toBe(true);
        });

        it('returns error for undersized image', () => {
            const result = validateImageForDistributor(createProfile('distrokid'), 1000, 1000);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('too small'))).toBe(true);
        });

        it('returns warning for oversized image', () => {
            const result = validateImageForDistributor(createProfile('distrokid'), 8000, 8000);

            // Should be valid but with warning
            expect(result.errors).toHaveLength(0);
            expect(result.warnings.some(w => w.includes('exceeds maximum'))).toBe(true);
        });
    });

    describe('getDistributorPromptContext', () => {
        it('generates AI context string with all constraints', () => {
            const context = getDistributorPromptContext(createProfile('distrokid'));

            expect(context).toContain('DistroKid');
            expect(context).toContain('3000x3000');
            expect(context).toContain('IMPORTANT');
        });

        it('returns generic context when no distributor', () => {
            const context = getDistributorPromptContext(createProfile());

            expect(context).toContain('Not configured');
            expect(context).toContain('industry-standard');
        });
    });

    describe('getRecommendedCanvasSize', () => {
        it('returns distributor-specific size', () => {
            const size = getRecommendedCanvasSize(createProfile('distrokid'));

            expect(size.width).toBe(3000);
            expect(size.height).toBe(3000);
        });

        it('returns default size when no distributor', () => {
            const size = getRecommendedCanvasSize(createProfile());

            expect(size.width).toBe(3000);
            expect(size.height).toBe(3000);
        });
    });
});
