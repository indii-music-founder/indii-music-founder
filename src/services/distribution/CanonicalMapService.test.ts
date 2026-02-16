
import { describe, it, expect } from 'vitest';
import { CanonicalMapService } from './CanonicalMapService';
import { ExtendedGoldenMetadata, INITIAL_METADATA } from '@/services/metadata/types';

describe('CanonicalMapService', () => {
    it('should validate a correct hierarchy (ISWC -> ISRC -> UPC)', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...INITIAL_METADATA,
            upc: '123456789012',
            trackTitle: 'Valid Track',
            tracks: [
                {
                    ...INITIAL_METADATA,
                    trackTitle: 'Track 1',
                    isrc: 'US-XYZ',
                    iswc: 'T-123'
                }
            ]
        } as any;

        const result = CanonicalMapService.validateHierarchy(metadata);
        expect(result.valid).toBe(true);
    });

    it('should fail if UPC is missing', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...INITIAL_METADATA,
            // No UPC
            tracks: []
        } as any;

        const result = CanonicalMapService.validateHierarchy(metadata);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Missing UPC');
    });

    it('should fail if ISRC is missing on a track', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...INITIAL_METADATA,
            upc: '123456789012',
            tracks: [
                {
                    ...INITIAL_METADATA,
                    trackTitle: 'No ISRC Track',
                    isrc: ''
                }
            ]
        } as any;

        const result = CanonicalMapService.validateHierarchy(metadata);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Missing ISRC');
    });

    it('should fail if ISWC is missing (Black Box prevention)', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...INITIAL_METADATA,
            upc: '123456789012',
            tracks: [
                {
                    ...INITIAL_METADATA,
                    trackTitle: 'No ISWC Track',
                    isrc: 'US-XYZ',
                    iswc: ''
                }
            ]
        } as any;

        const result = CanonicalMapService.validateHierarchy(metadata);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Composition rights unlinked');
    });
});
