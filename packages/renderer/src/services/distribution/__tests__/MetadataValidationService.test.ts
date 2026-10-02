import { describe, it, expect } from 'vitest';
import { MetadataValidationService } from '../MetadataValidationService';
import { IngestionMetadata } from '@/types/distribution';

describe('MetadataValidationService', () => {
    const validRelease: IngestionMetadata = {
        releaseId: 'rel-123',
        title: 'Neon Odyssey',
        artist: 'Aura',
        upc: '012345678905', // Valid GTIN-12
        artwork_url: 'https://cdn.indii.music/artworks/rel-123.png',
        tracks: [
            {
                title: 'Starlight',
                artist: 'Aura',
                isrc: 'USNDM2600001',
                track_number: 1,
                explicit: false,
            },
            {
                title: 'Solar Flare',
                artist: 'Aura',
                isrc: 'USNDM2600002',
                track_number: 2,
                explicit: false,
            }
        ]
    };

    it('passes completely for a valid release', () => {
        const result = MetadataValidationService.validateRelease(validRelease);
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
        expect(result.checksPassed).toBeGreaterThan(0);
    });

    it('flags missing or invalid UPC', () => {
        const releaseWithBadUPC: IngestionMetadata = {
            ...validRelease,
            upc: '12345', // Too short
        };
        const result = MetadataValidationService.validateRelease(releaseWithBadUPC);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.id === 'rel-upc-invalid')).toBe(true);
    });

    it('flags duplicate ISRCs across tracks in the same release', () => {
        const releaseWithDupeISRC: IngestionMetadata = {
            ...validRelease,
            tracks: [
                {
                    title: 'Track 1',
                    isrc: 'USNDM2600001',
                },
                {
                    title: 'Track 2',
                    isrc: 'USNDM2600001', // Duplicate!
                }
            ]
        };
        const result = MetadataValidationService.validateRelease(releaseWithDupeISRC);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.id.includes('isrc-duplicate'))).toBe(true);
    });

    it('flags invalid ISRC formatting', () => {
        const releaseWithBadISRC: IngestionMetadata = {
            ...validRelease,
            tracks: [
                {
                    title: 'Track 1',
                    isrc: 'NOT_AN_ISRC',
                }
            ]
        };
        const result = MetadataValidationService.validateRelease(releaseWithBadISRC);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.id.includes('isrc-invalid'))).toBe(true);
    });

    it('flags missing artwork', () => {
        const releaseNoArt: IngestionMetadata = {
            ...validRelease,
            artwork_url: '',
            cover_asset: undefined,
            cover_filename: undefined,
        };
        const result = MetadataValidationService.validateRelease(releaseNoArt);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.id === 'rel-cover-missing')).toBe(true);
    });
});
