/**
 * AudioVisualDirectionService
 *
 * Translates post-mastering deterministic acoustic features (BPM, key, dynamic range,
 * spectral centroid, LUFS) directly into visual design tokens (color palette, typography scale,
 * motion velocity, aspect ratio) via Jev System One without interactive prompt loops.
 */

import {
    judgeAudioToVisualTokens,
    type AcousticFeatureProfile,
    type AudioToVisualTokensResult,
} from '@/config/typesafeJudgments';
import { logger } from '@/utils/logger';

export class AudioVisualDirectionService {
    /**
     * Map track acoustic metrics directly to visual styling tokens
     */
    static async deriveVisualTokensFromAcoustics(
        profile: AcousticFeatureProfile
    ): Promise<AudioToVisualTokensResult> {
        logger.info(`[AudioVisualDirectionService] Deriving visual tokens for acoustic profile (BPM ${profile.bpm}, LUFS ${profile.integratedLufs})`);
        return judgeAudioToVisualTokens(profile);
    }
}
