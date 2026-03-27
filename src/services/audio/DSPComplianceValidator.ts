import { logger } from '@/utils/logger';

export interface DSPLimits {
    targetLufs: number;
    maxTruePeak: number;
    minSampleRate: number;
    minBitDepth: number;
    platform: string;
}

export interface DSPComplianceReport {
    isCompliant: boolean;
    platformChecks: Record<string, {
        compliant: boolean;
        warnings: string[];
    }>;
    flags: string[];
}

export class DSPComplianceValidator {
    private static PLATFORM_LIMITS: DSPLimits[] = [
        { platform: 'Spotify', targetLufs: -14.0, maxTruePeak: -1.0, minSampleRate: 44100, minBitDepth: 16 },
        { platform: 'Apple Music', targetLufs: -16.0, maxTruePeak: -1.0, minSampleRate: 44100, minBitDepth: 16 },
        { platform: 'YouTube', targetLufs: -14.0, maxTruePeak: -1.0, minSampleRate: 44100, minBitDepth: 16 },
    ];

    /**
     * Cross-references the calculated audio metrics against standard DSP limits.
     * Generates specific systemic flags for the MusicAgent/Conductor if the audio is out of bounds.
     */
    static validateAudio(
        integratedLufs: number,
        truePeakDb: number,
        sampleRate: number,
        bitDepth: number = 16 // Default to 16-bit unless verified
    ): DSPComplianceReport {
        const report: DSPComplianceReport = {
            isCompliant: true,
            platformChecks: {},
            flags: []
        };

        let hasFails = false;

        for (const limit of this.PLATFORM_LIMITS) {
            const warnings: string[] = [];
            let compliant = true;

            // Check Loudness (Tolerance of +/- 1 LUFS)
            if (integratedLufs > limit.targetLufs + 1.0) {
                warnings.push(`Too loud: ${integratedLufs.toFixed(1)} LUFS (Target: ${limit.targetLufs} LUFS) - Will be penalized and artificially lowered.`);
                compliant = false;
            } else if (integratedLufs < limit.targetLufs - 2.0) {
                warnings.push(`Too quiet: ${integratedLufs.toFixed(1)} LUFS (Target: ${limit.targetLufs} LUFS) - May lack competitive energy.`);
                compliant = false;
            }

            // Check True Peak
            if (truePeakDb > limit.maxTruePeak) {
                warnings.push(`True Peak exceeds limit: ${truePeakDb.toFixed(1)} dBTP (Max: ${limit.maxTruePeak} dBTP) - Risk of digital distortion on transcode.`);
                compliant = false;
            }

            // Check Format Quality
            if (sampleRate < limit.minSampleRate) {
                warnings.push(`Sample rate too low: ${sampleRate}Hz (Minimum: ${limit.minSampleRate}Hz) - Rejection risk.`);
                compliant = false;
            }
            if (bitDepth < limit.minBitDepth) {
                warnings.push(`Bit depth too low: ${bitDepth}-bit (Minimum: ${limit.minBitDepth}-bit) - Rejection risk.`);
                compliant = false;
            }

            report.platformChecks[limit.platform] = { compliant, warnings };
            if (!compliant) hasFails = true;
        }

        report.isCompliant = !hasFails;

        // Build systemic flags to feed into the MusicAgent's orchestration prompt
        if (hasFails) {
            report.flags.push('CRITICAL: Track fails DSP loudness/true-peak compliance.');
            if (truePeakDb > -0.5) report.flags.push('DISTORTION RISK: True peak indicates hard clipping.');
            if (sampleRate < 44100) report.flags.push('REJECTION RISK: Format below required 44.1kHz threshold.');

            logger.warn('[DSPComplianceValidator] Track failed compliance checks', {
                flags: report.flags,
                integratedLufs,
                truePeakDb
            });
        } else {
            logger.info('[DSPComplianceValidator] Track passed all DSP compliance checks.');
        }

        return report;
    }
}
