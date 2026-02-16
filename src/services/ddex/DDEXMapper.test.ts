import { DDEXMapper } from './DDEXMapper';
import { AudioIntelligenceProfile } from '@/services/audio/types';
import { AI_MODELS } from '@/core/config/ai-models';

describe('DDEXMapper', () => {
    const mockProfile: AudioIntelligenceProfile = {
        id: 'test-fingerprint',
        modelVersion: AI_MODELS.TEXT.AGENT,
        analyzedAt: Date.now(),
        technical: {
            bpm: 120,
            key: 'C',
            scale: 'major',
            energy: 0.8,
            duration: 215.5, // 3:35
            danceability: 0.9,
            loudness: -5
        },
        semantic: {
            mood: ['Energetic', 'Happy'],
            genre: ['Pop'],
            instruments: ['Synth', 'Drums'],
            ddexGenre: 'Pop',
            ddexSubGenre: 'Synth Pop',
            language: 'eng',
            isExplicit: false,
            visualImagery: {
                abstract: 'Neon lights',
                narrative: 'City night drive',
                lighting: 'Cyberpunk'
            },
            marketingHooks: {
                keywords: ['summer', 'drive', 'neon'],
                oneLiner: 'A perfect summer night driving anthem.'
            },
            targetPrompts: {
                imagen: 'foo',
                veo: 'bar'
            }
        }
    };

    it('should map valid profile to metadata', () => {
        const result = DDEXMapper.mapAudioProfileToMetadata(mockProfile);

        expect(result.genre).toBe('Pop');
        expect(result.subGenre).toBe('Synth Pop');
        expect(result.language).toBe('eng');
        expect(result.explicit).toBe(false);
        expect(result.durationFormatted).toBe('3:35');
        expect(result.marketingComment).toBe('A perfect summer night driving anthem.');
        expect(result.keywords).toContain('summer');
    });

    it('should handle instrumental tracks correctly', () => {
        const instrumentalProfile = {
            ...mockProfile,
            semantic: {
                ...mockProfile.semantic!,
                language: 'zxx'
            }
        };

        const result = DDEXMapper.mapAudioProfileToMetadata(instrumentalProfile);
        expect(result.language).toBe('zxx');
    });

    it('should format duration correctly', () => {
        // Access private method implicitly via public output
        const profile = { ...mockProfile, technical: { ...mockProfile.technical, duration: 65 } }; // 1:05
        const result = DDEXMapper.mapAudioProfileToMetadata(profile);
        expect(result.durationFormatted).toBe('1:05');
    });
});
