import { describe, it, expect } from 'vitest';
import { ERNMapper } from './ERNMapper';
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
    sender: { partyId: 'SENDER', partyName: 'Sender' },
    recipient: { partyId: 'RECIPIENT', partyName: 'Recipient' },
    createdDateTime: '2023-01-01T00:00:00Z'
};

describe('ERNMapper - Comprehensive Deal Types', () => {
    it('should include distributionChannelType="Stream" for streaming deals', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...BASE_METADATA,
            distributionChannels: ['streaming']
        };

        const ern = ERNMapper.mapMetadataToERN(metadata, DEFAULT_OPTIONS);
        const deals = ern.dealList;

        const streamDeal = deals.find(d => d.dealTerms.usage[0].useType === 'OnDemandStream');
        expect(streamDeal).toBeDefined();
        // This is expected to fail before implementation
        expect(streamDeal?.dealTerms.usage[0].distributionChannelType).toBe('Stream');
    });

    it('should include distributionChannelType="Download" for download deals', () => {
        const metadata: ExtendedGoldenMetadata = {
            ...BASE_METADATA,
            distributionChannels: ['download']
        };

        const ern = ERNMapper.mapMetadataToERN(metadata, DEFAULT_OPTIONS);
        const deals = ern.dealList;

        const downloadDeal = deals.find(d => d.dealTerms.usage[0].useType === 'PermanentDownload');
        expect(downloadDeal).toBeDefined();
        // This is expected to fail before implementation
        expect(downloadDeal?.dealTerms.usage[0].distributionChannelType).toBe('Download');
    });
});
