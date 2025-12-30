import { describe, it, expect } from 'vitest';
import { ERNMapper } from './ERNMapper';
import { ExtendedGoldenMetadata, INITIAL_METADATA } from '@/services/metadata/types';

describe('ERNMapper', () => {
    const mockMetadata: ExtendedGoldenMetadata = {
        ...INITIAL_METADATA,
        trackTitle: 'Test Track',
        artistName: 'Test Artist',
        releaseDate: '2025-01-01',
        labelName: 'Test Label',
        genre: 'Pop',
        upc: '123456789012',
        isrc: 'US-TST-25-00001',
        splits: [],
        territories: ['Worldwide'],
        distributionChannels: ['streaming', 'download'],
        aiGeneratedContent: {
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: false
        }
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { Deal } from './types/ern';

const MOCK_METADATA_BASE: ExtendedGoldenMetadata = {
    trackTitle: 'Test Track',
    artistName: 'Test Artist',
    isrc: 'USTEST12345',
    explicit: false,
    genre: 'Pop',
    labelName: 'Test Label',
    dpid: 'PADPIDA001',
    splits: [],
    pro: 'None',
    publisher: 'Self',
    containsSamples: false,
    isGolden: true,
    releaseType: 'Single',
    releaseDate: '2025-01-01',
    territories: ['Worldwide'],
    distributionChannels: [],
    upc: '123456789012',
    catalogNumber: 'TEST001',
    aiGeneratedContent: {
        isFullyAIGenerated: false,
        isPartiallyAIGenerated: false
    }
};

describe('ERNMapper Deal Generation', () => {
    const defaultOptions = {
        messageId: 'MSG-1',
        sender: { partyId: 'SENDER', partyName: 'Sender' },
        recipient: { partyId: 'RECIPIENT', partyName: 'Recipient' },
        createdDateTime: '2025-01-01T00:00:00Z'
    };

    const getDeals = (metadata: ExtendedGoldenMetadata): Deal[] => {
        const ern = ERNMapper.mapMetadataToERN(metadata, defaultOptions);
        return ern.dealList || [];
    };

    const options = {
        messageId: 'MSG-001',
        sender: 'SENDER-ID',
        recipient: 'RECIPIENT-ID',
        createdDateTime: '2025-01-01T12:00:00Z',
    };

    it('should map basic metadata to ERN message', () => {
        const ern = ERNMapper.mapMetadataToERN(mockMetadata, options);

        expect(ern.messageHeader.messageId).toBe(options.messageId);
        expect(ern.releaseList).toHaveLength(1);
        expect(ern.dealList.length).toBeGreaterThan(0);
    it('should generate Streaming deals correctly', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: ['streaming']
        };

        const deals = getDeals(metadata);

        // Expect 4 deals based on implementation:
        // 1. SubscriptionModel OnDemandStream Stream
        // 2. AdvertisementSupportedModel OnDemandStream Stream
        // 3. SubscriptionModel NonInteractiveStream Stream
        // 4. AdvertisementSupportedModel NonInteractiveStream Stream
        expect(deals).toHaveLength(4);

        const subDeal = deals.find(d =>
            d.dealTerms.commercialModelType === 'SubscriptionModel' &&
            d.dealTerms.usage[0].useType === 'OnDemandStream'
        );
        expect(subDeal).toBeDefined();

        const adDeal = deals.find(d =>
            d.dealTerms.commercialModelType === 'AdvertisementSupportedModel' &&
            d.dealTerms.usage[0].useType === 'OnDemandStream'
        );
        expect(adDeal).toBeDefined();
    });

        const mainRelease = ern.releaseList[0];
        expect(mainRelease.releaseTitle.titleText).toBe('Test Track');
        expect(mainRelease.releaseId.icpn).toBe(mockMetadata.upc);
    });

    it('should generate correct deals for streaming and download', () => {
        const ern = ERNMapper.mapMetadataToERN(mockMetadata, options);

        // Should have Subscription, AdSupported, NonInteractive for streaming (3)
        // And PayAsYouGo for download (1)
        // Total 4
        const dealTypes = ern.dealList.map(d => d.dealTerms.commercialModelType);
        expect(dealTypes).toContain('SubscriptionModel');
        expect(dealTypes).toContain('AdvertisementSupportedModel');
        expect(dealTypes).toContain('PayAsYouGoModel');
        expect(ern.dealList).toHaveLength(4);
    });

    it('should generate only streaming deals when download is excluded', () => {
        const streamingOnly: ExtendedGoldenMetadata = {
            ...mockMetadata,
            distributionChannels: ['streaming']
    it('should generate Download deals correctly', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: ['download']
        };

        const deals = getDeals(metadata);

        // Expect 1 deal: PayAsYouGoModel + PermanentDownload
        expect(deals).toHaveLength(1);

        const downloadDeal = deals.find(d =>
            d.dealTerms.commercialModelType === 'PayAsYouGoModel' &&
            d.dealTerms.usage[0].useType === 'PermanentDownload'
        );
        expect(downloadDeal).toBeDefined();
    });

    it('should generate both Streaming and Download deals when both channels are present', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: ['streaming', 'download']
        };

        const deals = getDeals(metadata);

        // Expect 5 deals total (4 streaming + 1 download)
        expect(deals).toHaveLength(5);
    });

    it('should fallback to default deals if no channels are specified (empty array)', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: []
        };

        const ern = ERNMapper.mapMetadataToERN(streamingOnly, options);

        // Subscription, AdSupported, NonInteractive (3)
        expect(ern.dealList).toHaveLength(3);
        const models = ern.dealList.map(d => d.dealTerms.commercialModelType);
        expect(models).not.toContain('PayAsYouGoModel');
    });

    it('should fallback to default deals if channels are empty', () => {
        const noChannels: ExtendedGoldenMetadata = {
            ...mockMetadata,
            distributionChannels: []
        const deals = getDeals(metadata);

        // Fallback: Streaming (Subscription) + Download
        expect(deals.length).toBe(2);

        const subDeal = deals.find(d => d.dealTerms.commercialModelType === 'SubscriptionModel');
        const downloadDeal = deals.find(d => d.dealTerms.commercialModelType === 'PayAsYouGoModel');

        expect(subDeal).toBeDefined();
        expect(downloadDeal).toBeDefined();
    });

    it('should correctly set territories and start date', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            territories: ['US', 'CA'],
            releaseDate: '2025-05-01',
            distributionChannels: ['streaming']
        };

        const ern = ERNMapper.mapMetadataToERN(noChannels, options);

        // Should default to at least some streaming deals
        expect(ern.dealList.length).toBeGreaterThan(0);
        const models = ern.dealList.map(d => d.dealTerms.commercialModelType);
        expect(models).toContain('SubscriptionModel');
        const deals = getDeals(metadata);
        const deal = deals[0];

        expect(deal.dealTerms.territoryCode).toEqual(['US', 'CA']);
        expect(deal.dealTerms.validityPeriod.startDate).toBe('2025-05-01');
        expect(deal.dealTerms.releaseDisplayStartDate).toBe('2025-05-01');
    });

    it('should ignore "physical" channel and fallback if it is the only channel', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA_BASE,
            distributionChannels: ['physical']
        };

        const deals = getDeals(metadata);

        // Expect fallback behavior
        expect(deals.length).toBe(2);
    it('should map AI generation info correctly', () => {
        const aiMetadata: ExtendedGoldenMetadata = {
            ...mockMetadata,
            aiGeneratedContent: {
                isFullyAIGenerated: true,
                isPartiallyAIGenerated: false,
                aiToolsUsed: ['Suno', 'Udio'],
                humanContribution: 'Prompting and selection'
            }
        };

        const ern = ERNMapper.mapMetadataToERN(aiMetadata, options);
        const release = ern.releaseList[0];

        expect(release.aiGenerationInfo).toBeDefined();
        expect(release.aiGenerationInfo?.isFullyAIGenerated).toBe(true);
        expect(release.aiGenerationInfo?.aiToolsUsed).toContain('Suno');
    });
});
