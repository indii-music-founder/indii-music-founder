import { describe, it, expect } from 'vitest';
import { DDEXMapper } from '@/services/ddex/DDEXMapper';
import { ernService } from '@/services/ddex/ERNService';
import { ddexValidator } from '@/services/ddex/DDEXValidator';
import { AudioIntelligenceProfile } from '@/services/audio/types';
import { ExtendedGoldenMetadata, INITIAL_METADATA } from '@/services/metadata/types';
import { AI_MODELS } from '@/core/config/ai-models';

describe('CLIP (Audio) -> DDEX Integration Pipeline', () => {

    // 1. Mock the Output of Audio Intelligence (The "CLIP" part)
    const mockAIProfile: AudioIntelligenceProfile = {
        id: 'sonic-id-123',
        modelVersion: AI_MODELS.TEXT.AGENT,
        analyzedAt: Date.now(),
        technical: {
            bpm: 128,
            key: 'A',
            scale: 'minor',
            energy: 0.95,
            duration: 184, // 3:04
            danceability: 0.8,
            loudness: -4
        },
        semantic: {
            mood: ['Aggressive', 'Dark'],
            genre: ['Electronic'],
            instruments: ['Bass', 'Sampler'],
            ddexGenre: 'Electronica',
            ddexSubGenre: 'Techno',
            language: 'zxx', // Instrumental
            isExplicit: false,
            visualImagery: {
                abstract: 'Strobe lights',
                narrative: 'Warehouse party',
                lighting: 'Stark monochrome'
            },
            marketingHooks: {
                keywords: ['underground', 'techno', 'warehouse'],
                oneLiner: 'A peak-time warehouse weapon.'
            },
            targetPrompts: {
                imagen: 'foo',
                veo: 'bar'
            }
        }
    };

    // 2. Mock a User's Project Baseline (The "Metadata" part)
    const baseMetadata: ExtendedGoldenMetadata = {
        ...INITIAL_METADATA,
        trackTitle: 'Midnight Warehouse',
        artistName: 'DJ Test',
        isrc: 'US-S1Z-25-00001',
        labelName: 'Test Records',
        dpid: 'PADPIDA20251226',
        releaseType: 'Single',
        releaseDate: '2025-12-31',
        territories: ['Worldwide'],
        distributionChannels: ['streaming', 'download'],
        // User might not have set these yet, expecting AI to fill them:
        // genre, language, explicit, duration
        genre: '',
        explicit: false,
        durationSeconds: 0,
        aiGeneratedContent: {
            isFullyAIGenerated: false,
            isPartiallyAIGenerated: false
        }
    };

    it('should successfully translate AI analysis into a valid DDEX ERN message', async () => {
        // Step A: Map AI Profile to DDEX Metadata fields
        const aiMetadata = DDEXMapper.mapAudioProfileToMetadata(mockAIProfile);

        expect(aiMetadata.genre).toBe('Electronica');
        expect(aiMetadata.subGenre).toBe('Techno');
        expect(aiMetadata.durationFormatted).toBe('3:04');
        expect(aiMetadata.marketingComment).toBe('A peak-time warehouse weapon.');

        // Step B: Merge with Base Metadata
        const finalMetadata: ExtendedGoldenMetadata = {
            ...baseMetadata,
            ...aiMetadata
        };

        // Step C: Generate ERN
        const result = await ernService.generateERN(finalMetadata, 'PADPIDA20251226', 'generic', undefined, { isTestMode: true });

        expect(result.success).toBe(true);
        expect(result.xml).toBeDefined();

        const xml = result.xml!;

        // Step D: Verify Content in XML
        // Check for mapped values
        expect(xml).toContain('<GenreText>Electronica</GenreText>');
        expect(xml).toContain('<SubGenre>Techno</SubGenre>');
        expect(xml).toContain('<Duration>PT3M4S</Duration>');
        expect(xml).toContain('<LanguageOfPerformance>zxx</LanguageOfPerformance>'); // Instrumental

        // Step E: Validate with DDEX Validator (Schema integrity)
        const validation = ddexValidator.validateXML(xml, '4.3');
        expect(validation.valid).toBe(true);
        expect(validation.errors).toEqual([]);

        // Optional: Log the XML for visual inspection if needed
        // console.log(xml);
    });
});
