import { describe, it, expect } from 'vitest';
import { ERNMapper } from './ERNMapper';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';

describe('ERNMapper', () => {
    // Basic Mock Metadata
    const mockMetadata: ExtendedGoldenMetadata = {
        internalId: 'uuid-123',
        upc: '1234567890123',
        catalogNumber: 'CAT-001',
        isrc: 'US-S1Z-22-00001',
        releaseTitle: 'My Single',
        trackTitle: 'My Single',
        artistName: 'Test Artist',
        releaseType: 'Single',
        releaseDate: '2023-01-01',
        genre: 'Pop',
        subGenre: 'Synth-Pop',
        labelName: 'My Label',
        cLineYear: '2023',
        cLineText: 'My Label',
        pLineYear: '2023',
        pLineText: 'My Label',
        explicit: false,
        language: 'en',
        territories: ['Worldwide'],
        distributionChannels: ['streaming', 'download'],
        splits: [],
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const options = {
        messageId: 'MSG-001',
        sender: 'SENDER-DPID',
        recipient: 'RECIPIENT-DPID',
        createdDateTime: '2023-01-01T12:00:00Z',
    };

    it('should map streaming channel to Subscription and Ad-Supported deals', () => {
        const metadata = { ...mockMetadata, distributionChannels: ['streaming'] };
        const ern = ERNMapper.mapMetadataToERN(metadata, options);

        const dealTypes = ern.dealList?.map(d => d.dealTerms.commercialModelType);
        expect(dealTypes).toContain('SubscriptionModel');
        expect(dealTypes).toContain('AdvertisementSupportedModel');
    });

    it('should map download channel to PayAsYouGo deal', () => {
        const metadata = { ...mockMetadata, distributionChannels: ['download'] };
        const ern = ERNMapper.mapMetadataToERN(metadata, options);

        const dealTypes = ern.dealList?.map(d => d.dealTerms.commercialModelType);
        expect(dealTypes).toContain('PayAsYouGoModel');
    });

    it('should default to both if no channels specified (Backward Compatibility - Empty Array)', () => {
        const metadata = { ...mockMetadata, distributionChannels: [] };
        const ern = ERNMapper.mapMetadataToERN(metadata, options);

        const dealTypes = ern.dealList?.map(d => d.dealTerms.commercialModelType);
        expect(dealTypes).toContain('SubscriptionModel');
        expect(dealTypes).toContain('PayAsYouGoModel');
    });

    it('should default to both if no channels specified (Backward Compatibility - Missing Prop)', () => {
        const metadata = { ...mockMetadata };
        // @ts-expect-error - Simulating legacy data without distributionChannels
        delete metadata.distributionChannels;
        const ern = ERNMapper.mapMetadataToERN(metadata, options);

        const dealTypes = ern.dealList?.map(d => d.dealTerms.commercialModelType);
        expect(dealTypes).toContain('SubscriptionModel');
        expect(dealTypes).toContain('PayAsYouGoModel');
    });
});
