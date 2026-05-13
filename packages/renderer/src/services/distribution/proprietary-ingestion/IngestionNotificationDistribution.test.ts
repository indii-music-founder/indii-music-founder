import { describe, it, expect } from 'vitest';
import { IngestionNotificationMapper } from './IngestionNotificationMapper';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';

const BASE_METADATA: ExtendedGoldenMetadata = {
    trackTitle: 'Test Track',
    artistName: 'Test Artist',
    isrc: 'US1234567890',
    explicit: false,
    genre: 'Pop',
    labelName: 'Test Label',
    splits: [],
    pro: 'None',
    publisher: 'Self',
    containsSamples: false,
    isGolden: true,
    releaseType: 'Single',
    releaseDate: '2023-01-01',
    territories: ['Worldwide'],
    distributionChannels: [],
    aiGeneratedContent: {
        isFullyAIGenerated: false,
        isPartiallyAIGenerated: false
    }
};

const DEFAULT_OPTIONS = {
    messageId: 'MSG-1',
    sender: { systemIdentifier: 'SENDER', entityName: 'Sender' },
    recipient: { systemIdentifier: 'RECIPIENT', entityName: 'Recipient' },
    createdDateTime: '2023-01-01T00:00:00Z'
};

describe('IngestionNotificationMapper - Deal Logic Verification', () => {
    it('should generate Streaming deals when "streaming" channel is present', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...BASE_METADATA,
            distributionChannels: ['streaming']
        };

        const ern = IngestionNotificationMapper.mapMetadataToIngestionNotification(metadata, DEFAULT_OPTIONS);
        const deals = ern.dealList;

        // Expect Subscription + OnDemandStream
        const subscription = deals.find(d =>
            d.dealTerms.commercialModelType === 'SubscriptionModel' &&
            d.dealTerms.usage[0]!.useType === 'OnDemandStream'
        );
        expect(subscription).toBeDefined();

        // Expect Ad-Supported + OnDemandStream
        const adSupported = deals.find(d =>
            d.dealTerms.commercialModelType === 'AdvertisementSupportedModel' &&
            d.dealTerms.usage[0]!.useType === 'OnDemandStream'
        );
        expect(adSupported).toBeDefined();

        // Should NOT have Download deals
        const download = deals.find(d =>
            d.dealTerms.commercialModelType === 'PayAsYouGoModel'
        );
        expect(download).toBeUndefined();
    });

    it('should generate Download deals when "download" channel is present', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...BASE_METADATA,
            distributionChannels: ['download']
        };

        const ern = IngestionNotificationMapper.mapMetadataToIngestionNotification(metadata, DEFAULT_OPTIONS);
        const deals = ern.dealList;

        const download = deals.find(d =>
            d.dealTerms.commercialModelType === 'PayAsYouGoModel' &&
            d.dealTerms.usage[0]!.useType === 'PermanentDownload'
        );
        expect(download).toBeDefined();

        const streaming = deals.find(d =>
            d.dealTerms.commercialModelType === 'SubscriptionModel'
        );
        expect(streaming).toBeUndefined();
    });

    it('should generate both when both channels are present', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...BASE_METADATA,
            distributionChannels: ['streaming', 'download']
        };

        const ern = IngestionNotificationMapper.mapMetadataToIngestionNotification(metadata, DEFAULT_OPTIONS);
        const deals = ern.dealList;

        expect(deals.length).toBeGreaterThanOrEqual(3); // 2 streaming + 1 download
    });

    it('should fallback to both if no channels specified', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...BASE_METADATA,
            distributionChannels: []
        };

        const ern = IngestionNotificationMapper.mapMetadataToIngestionNotification(metadata, DEFAULT_OPTIONS);
        const deals = ern.dealList;

        expect(deals.length).toBeGreaterThanOrEqual(2);
    });
});
