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
        };
        const ern = ERNMapper.mapMetadataToERN(noChannels, options);

        // Should default to at least some streaming deals
        expect(ern.dealList.length).toBeGreaterThan(0);
        const models = ern.dealList.map(d => d.dealTerms.commercialModelType);
        expect(models).toContain('SubscriptionModel');
    });

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
