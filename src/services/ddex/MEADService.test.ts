import { describe, it, expect } from 'vitest';
import { meadService } from './MEADService';
import { MOCK_METADATA } from './ERNService.test'; // Reuse mock metadata
import { ExtendedGoldenMetadata } from '@/services/metadata/types';

describe('MEADService', () => {
    it('should generate a valid MEAD object from metadata', () => {
        // Enrich mock metadata with lyrics and description
        const richMetadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA,
            marketingComment: 'A revolutionary album that changes everything.',
            tracks: [
                {
                    title: 'Track 1',
                    isrc: 'US1234567890',
                    lyrics: 'Verse 1: Hello World...'
                }
            ]
        } as any;

        const mead = meadService.generateMEAD(richMetadata, undefined, 'TestRecipient');

        expect(mead.messageHeader).toBeDefined();
        expect(mead.messageHeader.messageRecipient.partyId).toBe('TestRecipient');
        expect(mead.meadMessageContent.releases.length).toBe(1);

        const release = mead.meadMessageContent.releases[0];
        expect(release.detailsByTerritory[0].promotionalDetails?.marketingMessage).toBe('A revolutionary album that changes everything.');

        // BIO Check
        expect(release.detailsByTerritory[0].artistBiographies).toBeDefined();
        expect(release.detailsByTerritory[0].artistBiographies?.[0].biographyText).toContain('revolutionary');

        // LYRICS Check
        expect(release.resourceList.length).toBe(1);
        const resource = release.resourceList[0];
        expect(resource.lyrics).toBeDefined();
        expect(resource.lyrics?.[0].text).toBe('Verse 1: Hello World...');
    });
});
