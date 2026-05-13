import { describe, it, expect } from 'vitest';
import { IngestionNotificationService } from './IngestionNotificationService';
import { IngestionNotificationMapper } from './IngestionNotificationMapper';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
export const MOCK_METADATA: ExtendedGoldenMetadata = {
    trackTitle: 'Midnight City',
    artistName: 'M83',
    isrc: 'USM831100012',
    explicit: false,
    genre: 'Electronic',
    labelName: 'Mute Records',
    systemIdentity: 'PASystemIdentityA001',
    splits: [
        { legalName: 'M83', role: 'songwriter', percentage: 100, email: 'anthony@m83.com' }
    ],
    pro: 'ASCAP',
    publisher: 'Downtown Music',
    containsSamples: false,
    isGolden: true,
    releaseType: 'Single' as const,
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

describe('IngestionNotificationService', () => {
    const ingestionNotificationService = new IngestionNotificationService();

    it('should generate a valid IngestionNotification object from metadata', async () => {
        const result = await ingestionNotificationService.generateIngestionNotification(MOCK_METADATA);
        console.log('RESULT', result);
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
        const result = await ingestionNotificationService.generateIngestionNotification(aiMetadata);
        const parseResult = ingestionNotificationService.parseIngestionNotification(result.xml!);
        expect(parseResult.success).toBe(true);
        const release = parseResult.data!.releaseList[0];
        expect(release!.aiGenerationInfo?.isFullyAIGenerated).toBe(true);
    });
});

describe('IngestionNotificationMapper', () => {
    const OPTIONS = {
        messageId: '1',
        sender: { systemIdentifier: 'P1', entityName: 'S' },
        recipient: { systemIdentifier: 'P2', entityName: 'R' },
        createdDateTime: new Date().toISOString()
    };

    it('should map contributors correctly', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...MOCK_METADATA,
            splits: [
                { legalName: 'Artist A', role: 'performer', percentage: 50, email: '' },
                { legalName: 'Writer B', role: 'songwriter', percentage: 50, email: '' }
            ],
            artistName: 'Artist A'
        };

        const ern = IngestionNotificationMapper.mapMetadataToIngestionNotification(metadata, OPTIONS);

        const release = ern.releaseList[0];
        const contributors = release!.contributors;

        const mainArtist = contributors.find(c => c.name === 'Artist A');
        expect(mainArtist).toBeDefined();
        expect(mainArtist?.role).toBe('MainArtist');

        const composer = contributors.find(c => c.name === 'Writer B');
        expect(composer).toBeDefined();
        expect(composer?.role).toBe('Composer');
    });

    describe('Deal Mapping', () => {
        const BASE_METADATA: ExtendedGoldenMetadata = {
            ...MOCK_METADATA,
            distributionChannels: [],
        };

        it('should generate Subscription and AdvertisementSupported deals for streaming', () => {
            const metadata: ExtendedGoldenMetadata = {
                ...BASE_METADATA,
                distributionChannels: ['streaming']
            };

            const ern = IngestionNotificationMapper.mapMetadataToIngestionNotification(metadata, OPTIONS);
            const deals = ern.dealList;

            const subscriptionDeal = deals.find(d =>
                d.dealTerms.commercialModelType === 'SubscriptionModel' &&
                d.dealTerms.usage[0]!.useType === 'OnDemandStream'
            );

            const adSupportedDeal = deals.find(d =>
                d.dealTerms.commercialModelType === 'AdvertisementSupportedModel' &&
                d.dealTerms.usage[0]!.useType === 'OnDemandStream'
            );

            expect(subscriptionDeal).toBeDefined();
            expect(adSupportedDeal).toBeDefined();
        });

        it('should generate PayAsYouGo deals for download', () => {
            const metadata: ExtendedGoldenMetadata = {
                ...BASE_METADATA,
                distributionChannels: ['download']
            };

            const ern = IngestionNotificationMapper.mapMetadataToIngestionNotification(metadata, OPTIONS);
            const deals = ern.dealList;

            const downloadDeal = deals.find(d =>
                d.dealTerms.commercialModelType === 'PayAsYouGoModel' &&
                d.dealTerms.usage[0]!.useType === 'PermanentDownload'
            );

            expect(downloadDeal).toBeDefined();
        });

        it('should default to both if no channels specified (fallback)', () => {
            const metadata: ExtendedGoldenMetadata = {
                ...BASE_METADATA,
                distributionChannels: []
            };

            const ern = IngestionNotificationMapper.mapMetadataToIngestionNotification(metadata, OPTIONS);
            const deals = ern.dealList;

            expect(deals.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('should allow configuring messageControlType', () => {
        const ern = IngestionNotificationMapper.mapMetadataToIngestionNotification(MOCK_METADATA, {
            ...OPTIONS,
            messageControlType: 'TestMessage'
        });

        expect(ern.messageHeader.messageControlType).toBe('TestMessage');
    });

    it('should default messageControlType to LiveMessage', () => {
        const ern = IngestionNotificationMapper.mapMetadataToIngestionNotification(MOCK_METADATA, OPTIONS);

        expect(ern.messageHeader.messageControlType).toBe('LiveMessage');
    });
});
