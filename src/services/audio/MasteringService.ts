/**
 * MasteringService.ts
 * 
 * Provides AI-assisted mastering recommendations and target-specific presets.
 * Fulfills PRODUCTION_200 item #102.
 */

import { logger } from '@/utils/logger';
import { audioAnalysisService } from './AudioAnalysisService';
import { audioIntelligence } from './AudioIntelligenceService';

export interface MasteringPreset {
    id: string;
    name: string;
    targetLUFS: number; // Integrated LUFS
    peakLimit: number; // dBTP
    description: string;
}

export const MASTERING_PRESETS: Record<string, MasteringPreset> = {
    spotify: {
        id: 'spotify',
        name: 'Spotify',
        targetLUFS: -14.0,
        peakLimit: -1.0,
        description: 'Optimized for Spotify normalization (-14 LUFS).'
    },
    apple: {
        id: 'apple',
        name: 'Apple Music',
        targetLUFS: -16.0,
        peakLimit: -1.0,
        description: 'Optimized for Apple Music normalization (-16 LUFS).'
    },
    youtube: {
        id: 'youtube',
        name: 'YouTube',
        targetLUFS: -13.0,
        peakLimit: -1.0,
        description: 'Optimized for YouTube content ID and normalization.'
    },
    soundcloud: {
        id: 'soundcloud',
        name: 'SoundCloud',
        targetLUFS: -9.0, // Often louder on soundcloud
        peakLimit: -0.3,
        description: 'Aggressive "loudness" master for non-normalized platforms.'
    },
    club: {
        id: 'club',
        name: 'Club/DJ',
        targetLUFS: -8.0,
        peakLimit: -0.1,
        description: 'Maximum impact and loudness for club play.'
    }
};

export interface MasteringRecommendation {
    preset: MasteringPreset;
    gainOffset: number; // dB gain required
    equalization: {
        lowShelf: number; // Hz -> dB
        lowMid: number;
        mid: number;
        highMid: number;
        highShelf: number;
    };
    compression: {
        threshold: number;
        ratio: number;
        attack: number;
        release: number;
    };
    limiter: {
        ceiling: number;
        threshold: number;
    };
}

export class MasteringService {
    /**
     * Recommends a mastering chain based on a target preset and audio analysis.
     */
    async getRecommendation(file: File, presetId: string): Promise<MasteringRecommendation> {
        const preset: MasteringPreset = MASTERING_PRESETS[presetId] ?? MASTERING_PRESETS['spotify']!;

        logger.info(`[Mastering] Generating recommendation for ${file.name} using ${preset.name} preset.`);

        // 1. Get Technical Analysis
        const analysis = await audioAnalysisService.analyze(file);
        const audit = analysis.features.audit;

        if (!audit) {
            throw new Error('Could not perform technical audit for mastering recommendation.');
        }

        // 2. Calculate Gain Offset for LUFS target
        // currentLoudness + gainOffset = targetLUFS
        const gainOffset = preset.targetLUFS - audit.integratedLoudness;

        // 3. AI Spectral Analysis for EQ (Mocking intelligence based on Genre)
        const intel = await audioIntelligence.analyze(file);
        const genre = intel.semantic.ddexGenre.toLowerCase();

        // 4. Heuristic-based EQ/Comp suggestions (V1)
        // In V2, this will use Gemini to "listen" and recommend specific EQ frequencies.
        const recommendation: MasteringRecommendation = {
            preset,
            gainOffset: Math.min(Math.max(gainOffset, -12), 12), // Limit to +/- 12dB for safety
            equalization: this.suggestEQ(genre),
            compression: this.suggestCompression(genre),
            limiter: {
                ceiling: preset.peakLimit,
                threshold: -1.0 // Initial threshold for the limiter
            }
        };

        return recommendation;
    }

    private suggestEQ(genre: string) {
        // Base profile - subtle enhancements
        const eq = { lowShelf: 0, lowMid: 0, mid: 0, highMid: 0, highShelf: 1.5 };

        if (genre.includes('hip') || genre.includes('trap')) {
            eq.lowShelf = 2.0; // Boost subs
            eq.highMid = -1.0; // Tame harsh transients
        } else if (genre.includes('rock') || genre.includes('metal')) {
            eq.mid = -1.5; // Tame mid congestion
            eq.highShelf = 2.5; // Add air
        } else if (genre.includes('electronic') || genre.includes('techno')) {
            eq.lowShelf = 1.0;
            eq.highShelf = 2.0;
        }

        return eq;
    }

    private suggestCompression(genre: string) {
        const comp = { threshold: -18, ratio: 2.0, attack: 30, release: 100 };

        if (genre.includes('rock')) {
            comp.ratio = 3.0; // More aggressive gluing
            comp.attack = 10;
        } else if (genre.includes('electronic')) {
            comp.ratio = 1.5; // Transparent glue
            comp.attack = 50;
        }

        return comp;
    }

    /**
     * Applies a mastering profile to an AudioBuffer (Conceptual realization).
     * This would feed into the DSP chain in the studio's Export service.
     */
    getMasteringChain(recommendation: MasteringRecommendation) {
        return [
            { type: 'EQ', parameters: recommendation.equalization },
            { type: 'Compressor', parameters: recommendation.compression },
            { type: 'Gain', parameters: { gain: recommendation.gainOffset } },
            { type: 'Limiter', parameters: recommendation.limiter }
        ];
    }
}

export const masteringService = new MasteringService();
