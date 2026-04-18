import { describe, it, expect } from 'vitest';
import { DistributionTools } from '@/services/agent/tools/DistributionTools';
import { ernService } from '@/services/ddex/ERNService';
import { DDEXParser } from '@/services/ddex/DDEXParser';
import { ExtendedGoldenMetadata, INITIAL_METADATA } from '@/services/metadata/types';

describe('YouTube Content ID -> DDEX Integration Pipeline', () => {
    it('should successfully persist Content ID opt-in, generate XML, and parse it back', async () => {
        // 1. Simulate the User Agent toggling Content ID on via DistributionTools
        const toggleResult = await DistributionTools.toggle_content_id({
            trackId: 'test-release-id',
            optIn: true,
            policy: 'block'
        });

        expect(toggleResult.success).toBe(true);
        expect(toggleResult.data?.contentIdStatus).toBe('OPTED_IN');
        expect(toggleResult.data?.policy).toBe('block');

        // 2. Simulate reading the updated release metadata from the DB
        // In reality, this is done by the caller of prepare_release or ERNMapper.
        // We simulate the updated metadata state.
        const baseMetadata: ExtendedGoldenMetadata = {
            ...INITIAL_METADATA,
            id: 'test-release-id',
            trackTitle: 'Content ID Test Track',
            artistName: 'Test Artist',
            isrc: 'US-S1Z-25-00002',
            labelName: 'Test Records',
            releaseType: 'Single',
            releaseDate: '2025-12-31',
            territories: ['Worldwide'],
            distributionChannels: ['streaming'],
            genre: 'Electronic',
            explicit: false,
            // This is the property updated by the tool (mirrors what the DB has)
            youtubeContentIdOptIn: true,
            youtubeContentIdPolicy: 'block'
        };

        // 3. Generate the DDEX ERN XML using the ERNService
        const ernResult = await ernService.generateERN(baseMetadata, 'PADPIDA123', 'generic', undefined, { isTestMode: true });
        
        expect(ernResult.success).toBe(true);
        expect(ernResult.xml).toBeDefined();

        const xml = ernResult.xml!;

        // Check raw XML for ProprietaryExtension
        expect(xml).toContain('<ExtensionCode>YouTubeContentIdPolicy</ExtensionCode>');
        expect(xml).toContain('<ExtensionPayload>block</ExtensionPayload>');
        // Check for specific use type related to 'block'
        expect(xml).toContain('<UseType>NonInteractiveStream</UseType>');

        // 4. Parse the generated ERN XML back into JSON using DDEXParser
        const parseResult = DDEXParser.parseERN(xml);
        expect(parseResult.success).toBe(true);
        expect(parseResult.data).toBeDefined();

        // 5. Verify the proprietary extension was parsed correctly
        const parsedDeals = parseResult.data!.dealList;
        // There should be a deal with youtubeContentIdPolicy === 'block'
        const contentIdDeal = parsedDeals.find(d => d.youtubeContentIdPolicy === 'block');
        
        expect(contentIdDeal).toBeDefined();
        expect(contentIdDeal?.youtubeContentIdPolicy).toBe('block');
        // 'block' policy should use NonInteractiveStream
        expect(contentIdDeal!.dealTerms.usage[0]!.useType).toBe('NonInteractiveStream');
    });
});
