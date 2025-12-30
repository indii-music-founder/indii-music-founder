import { describe, it, expect } from 'vitest';
import { ERNService } from './ERNService';
import { ERNMapper } from './ERNMapper';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { DDEX_CONFIG } from '@/core/config/ddex';

export const MOCK_METADATA: ExtendedGoldenMetadata = {
    trackTitle: 'Midnight City',
    artistName: 'M83',
    isrc: 'USM831100012',
    explicit: false,
    genre: 'Electronic',
    labelName: 'Mute Records',
    dpid: 'PADPIDA001',
    splits: [
        { legalName: 'M83', role: 'songwriter', percentage: 100, email: 'anthony@m83.com' }
    ],
    pro: 'ASCAP',
    publisher: 'Downtown Music',
    containsSamples: false,
    isGolden: true,
    releaseType: 'Single',
    releaseDate: '2011-10-18',
    territories: ['Worldwide'],
    distributionChannels: ['streaming', 'download'],
    upc: '123456789012',
    catalogNumber: 'MUTE123',
    marketingComment: 'Hit single',
    aiGeneratedContent: {
        isFullyAIGenerated: false,
        isPartiallyAIGenerated: false
    }
};

describe('ERNService', () => {
    const ernService = new ERNService();

    it('should generate a valid ERN object from metadata', async () => {
        const result = await ernService.generateERN(MOCK_METADATA);
        expect(result.success).toBe(true);
        expect(result.xml).toBeDefined();
        // Basic XML check
        expect(result.xml).toContain('Midnight City');
        expect(result.xml).toContain('M83');
        expect(result.xml).toContain('USM831100012');
    });

    it('should include correct AI flags in generated XML', async () => {
        const aiMetadata = {
            ...MOCK_METADATA,
            aiGeneratedContent: {
                isFullyAIGenerated: true,
                isPartiallyAIGenerated: false,
                aiToolsUsed: ['Suno', 'Udio']
            }
        };
        const result = await ernService.generateERN(aiMetadata);
        // XMLBuilder might flatten booleans, checking logic
        // Depending on parser implementation, verify structure via parse
        const parseResult = ernService.parseERN(result.xml!);
        expect(parseResult.success).toBe(true);
        const release = parseResult.data!.releaseList[0];
        expect(release.aiGenerationInfo?.isFullyAIGenerated).toBe(true);
    });
});

describe('ERNMapper', () => {
    it('should map contributors correctly', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA,
            splits: [
                { legalName: 'Artist A', role: 'performer', percentage: 50, email: '' },
                { legalName: 'Writer B', role: 'songwriter', percentage: 50, email: '' }
            ],
            artistName: 'Artist A'
        };

        const ern = ERNMapper.mapMetadataToERN(metadata, {
            messageId: '1',
            sender: { partyId: 'P1', partyName: 'S' },
            recipient: { partyId: 'P2', partyName: 'R' },
            createdDateTime: new Date().toISOString()
        });

        const release = ern.releaseList[0];
        const contributors = release.contributors;

        // Expect Artist A as MainArtist
        const mainArtist = contributors.find(c => c.name === 'Artist A');
        expect(mainArtist).toBeDefined();
        expect(mainArtist?.role).toBe('MainArtist');

        // Expect Writer B as Composer
        const composer = contributors.find(c => c.name === 'Writer B');
        expect(composer).toBeDefined();
        expect(composer?.role).toBe('Composer');
    });

    describe('Deal Mapping', () => {
        const BASE_METADATA: ExtendedGoldenMetadata = {
            ...MOCK_METADATA,
            distributionChannels: [], // To be overridden
        };

        const OPTIONS = {
            messageId: '1',
            sender: { partyId: 'P1', partyName: 'S' },
            recipient: { partyId: 'P2', partyName: 'R' },
            createdDateTime: new Date().toISOString()
        };

        it('should generate Subscription and AdvertisementSupported deals for streaming', () => {
            const metadata: ExtendedGoldenMetadata = {
                ...BASE_METADATA,
                distributionChannels: ['streaming']
            };

            const ern = ERNMapper.mapMetadataToERN(metadata, OPTIONS);
            const deals = ern.dealList;

            const subscriptionDeal = deals.find(d =>
                d.dealTerms.commercialModelType === 'SubscriptionModel' &&
                d.dealTerms.usage[0].useType === 'OnDemandStream'
            );

            const adSupportedDeal = deals.find(d =>
                d.dealTerms.commercialModelType === 'AdvertisementSupportedModel' &&
                d.dealTerms.usage[0].useType === 'OnDemandStream'
            );

            expect(subscriptionDeal).toBeDefined();
            expect(adSupportedDeal).toBeDefined();
        });

        it('should generate PayAsYouGo deals for download', () => {
            const metadata: ExtendedGoldenMetadata = {
                ...BASE_METADATA,
                distributionChannels: ['download']
            };

            const ern = ERNMapper.mapMetadataToERN(metadata, OPTIONS);
            const deals = ern.dealList;

            const downloadDeal = deals.find(d =>
                d.dealTerms.commercialModelType === 'PayAsYouGoModel' &&
                d.dealTerms.usage[0].useType === 'PermanentDownload'
            );

            expect(downloadDeal).toBeDefined();
        });

        it('should default to both if no channels specified (fallback)', () => {
            const metadata: ExtendedGoldenMetadata = {
                ...BASE_METADATA,
                distributionChannels: [] // Empty
            };

            const ern = ERNMapper.mapMetadataToERN(metadata, OPTIONS);
            const deals = ern.dealList;

            expect(deals.length).toBeGreaterThanOrEqual(2); // At least Sub + Download
        });
    it('should allow configuring messageControlType', () => {
        const ern = ERNMapper.mapMetadataToERN(MOCK_METADATA, {
            messageId: '1',
            sender: { partyId: 'P1', partyName: 'S' },
            recipient: { partyId: 'P2', partyName: 'R' },
            createdDateTime: new Date().toISOString(),
            messageControlType: 'TestMessage'
        });

        expect(ern.messageHeader.messageControlType).toBe('TestMessage');
    });

    it('should default messageControlType to LiveMessage', () => {
        const ern = ERNMapper.mapMetadataToERN(MOCK_METADATA, {
            messageId: '1',
            sender: { partyId: 'P1', partyName: 'S' },
            recipient: { partyId: 'P2', partyName: 'R' },
            createdDateTime: new Date().toISOString()
        });

        expect(ern.messageHeader.messageControlType).toBe('LiveMessage');
    });
});

});
