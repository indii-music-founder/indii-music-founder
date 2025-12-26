import { describe, it, expect } from 'vitest';
import { ernService } from './ERNService';
import { INITIAL_METADATA, ExtendedGoldenMetadata } from '@/services/metadata/types';
import { DISTRIBUTORS } from '@/core/config/distributors';

describe('ERN Distribution Integration', () => {
    const mockMetadata: ExtendedGoldenMetadata = {
        ...INITIAL_METADATA,
        trackTitle: 'Test Track',
        artistName: 'Test Artist',
        isrc: 'US1234567890',
        upc: '123456789012',
        releaseType: 'Single',
        releaseDate: '2025-01-01',
        territories: ['Worldwide'],
        distributionChannels: ['streaming'],
        aiGeneratedContent: {
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: false
        }
    };

    it('should generate ERN for DistroKid with correct Party ID', async () => {
        const result = await ernService.generateERN(mockMetadata, undefined, 'distrokid');
        expect(result.success).toBe(true);
        expect(result.xml).toBeDefined();
        // Check for DistroKid's Party ID in the XML
        expect(result.xml).toContain(DISTRIBUTORS.distrokid.ddexPartyId);
    });

    it('should generate ERN for TuneCore with correct Party ID', async () => {
        const result = await ernService.generateERN(mockMetadata, undefined, 'tunecore');
        expect(result.success).toBe(true);
        expect(result.xml).toContain(DISTRIBUTORS.tunecore.ddexPartyId);
    });

    it('should fallback to Generic for unknown distributor', async () => {
        const result = await ernService.generateERN(mockMetadata, undefined, 'unknown_distro');
        expect(result.success).toBe(true);
        expect(result.xml).toContain(DISTRIBUTORS.generic.ddexPartyId);
    });
});
