/**
 * AutoCopywriter — Brain Calibration Session 4: The DDEX Bridge
 *
 * Converts emotional + sonic intelligence into high-conversion DSP marketing copy.
 * Goal: Translating feelings into commercial language that editorial teams actually use.
 *
 * Outputs:
 * - DDEX SoundRecording/MarketingComment (pitch copy for DSPs)
 * - Spotify editorial pitch
 * - Apple Music editorial notes
 * - Social media captions (Twitter/X, Instagram, TikTok)
 * - Press release one-liner
 */
import { GenAI } from '@/services/ai/GenAI';
import { AI_MODELS } from '@/core/config/ai-models';
import { Schema } from 'firebase/ai';
import { Logger } from '@/core/logger/Logger';
import { withServiceError } from '@/lib/errors';
import type { AudioSemanticData } from '@/services/audio/types';
import type { EmotionalNarrative } from '@/services/audio/EnergyMapService';

export interface CopywriterInput {
    trackTitle: string;
    artistName: string;
    semantic: AudioSemanticData;
    /** Optional — enriches copy with emotional arc data from Session 2 */
    emotionalNarrative?: EmotionalNarrative;
    /** Target release date for time-sensitive copy (ISO string) */
    releaseDate?: string;
}

export interface MarketingCopyPackage {
    /** DDEX SoundRecording > MarketingComment — 2-3 sentences max, DSP editorial pitch voice */
    ddexMarketingComment: string;
    /** Spotify Editorial pitch (250 chars max, no hashtags, no caps lock) */
    spotifyPitch: string;
    /** Apple Music editorial note (1 paragraph, poetic, less commercial) */
    appleMusicNote: string;
    /** Twitter/X post (280 chars, can include 1-2 hashtags) */
    tweetCopy: string;
    /** Instagram caption (can be longer, story-driven, ends with CTA) */
    instagramCaption: string;
    /** TikTok hook (first 3 seconds, punchy, trend-aware) */
    tiktokHook: string;
    /** Press release one-liner — journalist-ready, no fluff */
    pressOneLiner: string;
    /** 3-5 SEO keywords derived from genre + mood + timbre */
    seoKeywords: string[];
}

const COPY_SCHEMA: Schema = {
    type: 'OBJECT' as const,
    properties: {
        ddexMarketingComment: { type: 'STRING' },
        spotifyPitch: { type: 'STRING' },
        appleMusicNote: { type: 'STRING' },
        tweetCopy: { type: 'STRING' },
        instagramCaption: { type: 'STRING' },
        tiktokHook: { type: 'STRING' },
        pressOneLiner: { type: 'STRING' },
        seoKeywords: { type: 'ARRAY', items: { type: 'STRING' } }
    },
    required: [
        'ddexMarketingComment', 'spotifyPitch', 'appleMusicNote',
        'tweetCopy', 'instagramCaption', 'tiktokHook',
        'pressOneLiner', 'seoKeywords'
    ]
} as unknown as Schema;

export class AutoCopywriter {
    /**
     * Generates a full marketing copy package for a track.
     */
    async generateCopyPackage(input: CopywriterInput): Promise<MarketingCopyPackage> {
        return withServiceError('AutoCopywriter', 'generateCopyPackage', async () => {
            Logger.info('AutoCopywriter', `Generating copy for "${input.trackTitle}" by ${input.artistName}`);

            const prompt = this.buildPrompt(input);

            const copyPackage = await GenAI.generateStructuredData<MarketingCopyPackage>(
                [{ text: prompt }],
                COPY_SCHEMA,
                2048,
                'You are a Grammy-winning A&R copywriter and music marketing expert.',
                AI_MODELS.TEXT.AGENT
            );

            Logger.info('AutoCopywriter', `Copy generated for "${input.trackTitle}"`);
            return copyPackage;
        });
    }

    private buildPrompt(input: CopywriterInput): string {
        const { trackTitle, artistName, semantic, emotionalNarrative, releaseDate } = input;

        const arcContext = emotionalNarrative
            ? `
Emotional Arc Intelligence (Session 2 Data):
- Trajectory Shape: ${emotionalNarrative.trajectoryShape}
- Emotional Signature: ${emotionalNarrative.emotionalSignature}
- Tension Ratio: ${(emotionalNarrative.tensionRatio * 100).toFixed(0)}% tension
- Soul Peak: Beat index ${emotionalNarrative.soulPeakIndex} — ${emotionalNarrative.arc[emotionalNarrative.soulPeakIndex]?.emotion ?? 'unknown'} at ${emotionalNarrative.arc[emotionalNarrative.soulPeakIndex]?.timestamp?.toFixed(0) ?? '?'}s
`
            : '';

        return `
You are a world-class music marketing copywriter. You write for Spotify Editorial, Apple Music, and major label A&R teams.
Your job is to translate raw sonic intelligence into compelling commercial language.

=== TRACK INTELLIGENCE ===

Track: "${trackTitle}" by ${artistName}
${releaseDate ? `Release Date: ${releaseDate}` : ''}

Genre: ${semantic.ddexGenre} / ${semantic.ddexSubGenre}
Mood Tags: ${semantic.mood.join(', ')}
Instruments: ${semantic.instruments.join(', ')}
Timbre: ${semantic.timbre.texture} — ${semantic.timbre.brightness}
Production: ${semantic.productionValue.era} | ${semantic.productionValue.quality}
Mix: ${semantic.productionValue.mixBalance}
Language: ${semantic.language === 'zxx' ? 'Instrumental' : semantic.language}
Explicit: ${semantic.isExplicit ? 'Yes' : 'No'}
One-Liner (source material): ${semantic.marketingHooks.oneLiner}
Marketing Keywords (source): ${semantic.marketingHooks.keywords.join(', ')}
${arcContext}

=== YOUR COPY TARGETS ===

1. 'ddexMarketingComment': 2-3 sentences. DDEX pitch voice — concise, industry-professional.
   Reference the sonic texture, mood, and genre. This goes directly into DDEX XML distribution.

2. 'spotifyPitch': Max 250 characters. Spotify editorial voice — lowercase, no hashtags, no hype words
   like "amazing" or "banger". Focus on what the song SOUNDS like and who it's for.

3. 'appleMusicNote': 1 paragraph (3-5 sentences). Apple Music voice — poetic, slightly literary,
   describes the listening experience. Think: New Music Daily editorial notes.

4. 'tweetCopy': Max 280 characters. Punchy, shareable. Can include 1-2 relevant hashtags.
   Hook in the first 5 words.

5. 'instagramCaption': 3-5 sentences + 3-5 hashtags at the end. Story-driven.
   Create a narrative around the release. End with a clear CTA (link in bio, pre-save, stream now).

6. 'tiktokHook': Max 100 characters. This is the first 3 seconds of a voiceover or text overlay.
   Make it a question, a challenge, or a provocative statement that stops the scroll.

7. 'pressOneLiner': One clean sentence. Journalist-ready. No fluff, no "proud to announce".
   Lead with the most interesting thing about this track.

8. 'seoKeywords': 3-5 highly searchable keywords combining genre, mood, and production style.
   Think: what would a fan type to find this song?

CRITICAL RULES:
- Never use: "banger", "fire", "slaps", "amazing", "incredible", "proud to announce"
- Never use ALL CAPS for emphasis
- Spotify pitch must be lowercase
- All copy must feel earned from the track's actual sonic identity — not generic
- If the track has AI artifacts (${semantic.productionValue.aiArtifacts ? 'YES — handle carefully, do not highlight this negatively' : 'No — safe to emphasize authenticity'})
`;
    }
}

export const autoCopywriter = new AutoCopywriter();
