import { ValidationResult, ValidationError, ValidationWarning } from '@/services/ddex/types/common';
import { DistributorRequirements } from '@/services/distribution/types/distributor';

/**
 * AudioQCService
 * Performs technical and acoustic validation on audio assets before distribution.
 * High-Fidelity standards for major DSPs (Spotify, Apple Music, etc.)
 */
export class AudioQCService {

    /**
     * Perform a full QC check on an AudioBuffer.
     * @param buffer The decoded audio buffer to check.
     * @param requirements (Optional) Specific distributor requirements to validate against.
     */
    static async performQC(
        buffer: AudioBuffer,
        requirements?: DistributorRequirements['audio']
    ): Promise<ValidationResult> {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // 1. Technical Specs Check
        this.checkTechnicalSpecs(buffer, requirements, errors, warnings);

        // 2. Acoustic Check (Clipping, Silence)
        this.checkAcoustics(buffer, errors, warnings);

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Checks sample rate, duration, and channels.
     * NOTE: Bit depth is not available from WebAudio's AudioBuffer (always decoded to 32-bit float).
     * True bit depth validation requires server-side FFprobe analysis on the original file.
     */
    private static checkTechnicalSpecs(
        buffer: AudioBuffer,
        requirements: DistributorRequirements['audio'] | undefined,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ) {
        // Sample Rate
        const minSampleRate = requirements?.minSampleRate || 44100;
        if (buffer.sampleRate < minSampleRate) {
            errors.push({
                code: 'QC_LOW_SAMPLE_RATE',
                message: `Sample rate (${buffer.sampleRate}Hz) is below the minimum required (${minSampleRate}Hz).`,
                severity: 'error'
            });
        }

        // Channels
        if (buffer.numberOfChannels < 2) {
            warnings.push({
                code: 'QC_MONO_AUDIO',
                message: 'Audio is mono. Most distributors recommend stereo for better listener engagement.',
                severity: 'warning'
            });
        }

        // Duration (min 30s for most monetization)
        const minDuration = requirements?.minDurationSeconds || 30;
        if (buffer.duration < minDuration) {
            errors.push({
                code: 'QC_SHORT_DURATION',
                message: `Duration (${buffer.duration.toFixed(2)}s) is shorter than the minimum required (${minDuration}s).`,
                severity: 'error'
            });
        }
    }

    /**
     * Checks for clipping and silence.
     */
    private static checkAcoustics(
        buffer: AudioBuffer,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ) {
        const data = buffer.getChannelData(0); // Check the first channel
        let peak = 0;
        let silentSamplesAtStart = 0;
        let silentSamplesAtEnd = 0;
        const SILENCE_THRESHOLD = 0.0001;

        // Peak detection
        for (let i = 0; i < data.length; i++) {
            const absVal = Math.abs(data[i]!);
            if (absVal > peak) peak = absVal;
        }

        if (peak >= 1.0) {
            errors.push({
                code: 'QC_CLIPPING_DETECTED',
                message: 'Digital clipping detected. Peak amplitude reaches or exceeds 0dB.',
                severity: 'error'
            });
        } else if (peak < 0.2) {
            warnings.push({
                code: 'QC_LOW_VOLUME',
                message: 'Audio level is very quiet. Consider normalizing to -1.0dB peak.',
                severity: 'warning'
            });
        }

        // Silence detection at start
        for (let i = 0; i < data.length; i++) {
            if (Math.abs(data[i]!) > SILENCE_THRESHOLD) break;
            silentSamplesAtStart++;
        }

        // Silence detection at end
        for (let i = data.length - 1; i >= 0; i--) {
            if (Math.abs(data[i]!) > SILENCE_THRESHOLD) break;
            silentSamplesAtEnd++;
        }

        const startSilenceSec = silentSamplesAtStart / buffer.sampleRate;
        const endSilenceSec = silentSamplesAtEnd / buffer.sampleRate;

        if (startSilenceSec > 5.0) {
            warnings.push({
                code: 'QC_START_SILENCE',
                message: `Excessive silence at the beginning (${startSilenceSec.toFixed(2)}s).`,
                severity: 'warning'
            });
        }

        if (endSilenceSec > 5.0) {
            warnings.push({
                code: 'QC_END_SILENCE',
                message: `Excessive silence at the end (${endSilenceSec.toFixed(2)}s).`,
                severity: 'warning'
            });
        }
    }

    // ──────────────────────────────────────────────────────────────
    // Item 234: LUFS Loudness Compliance Validation
    // ──────────────────────────────────────────────────────────────

    /**
     * Measure approximate integrated loudness (LUFS-I) from an AudioBuffer.
     *
     * Uses a simplified ITU-R BS.1770 power measurement:
     *   - Apply a K-weighting filter approximation via squared RMS
     *   - Average across all channels (linked gating not applied)
     *
     * Accurate LUFS measurement requires a proper K-weighting IIR filter
     * (stage 1: high-shelf pre-filter, stage 2: high-pass RLB filter).
     * For production, delegate to the Electron main process which can use
     * the FFmpeg loudnorm filter for authoritative LUFS measurement.
     *
     * Returns: loudness in LUFS (approximate)
     */
    static measureLUFS(buffer: AudioBuffer): number {
        let sumSquares = 0;
        let totalSamples = 0;

        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < data.length; i++) {
                sumSquares += data[i]! * data[i]!;
            }
            totalSamples += data.length;
        }

        if (totalSamples === 0) return -Infinity;
        const meanSquare = sumSquares / totalSamples;
        if (meanSquare === 0) return -Infinity;

        // Convert to LUFS: LUFS = -0.691 + 10 * log10(mean_square)
        return -0.691 + 10 * Math.log10(meanSquare);
    }

    /**
     * Item 234: Check LUFS compliance for a specific DSP target.
     * Spotify: -14 LUFS-I target (blocks above -1 LUFS-I)
     * Apple Music: -16 LUFS-I target
     * YouTube: -14 LUFS-I target
     *
     * Returns errors (blocking) if the track is excessively loud.
     * Warnings if the track may be normalized down (quiet is fine, just not optimal).
     */
    static checkLUFSCompliance(
        buffer: AudioBuffer,
        errors: ValidationError[],
        warnings: ValidationWarning[],
        target: 'spotify' | 'apple' | 'youtube' | 'default' = 'default'
    ): number {
        const lufs = this.measureLUFS(buffer);
        const targets: Record<typeof target, { integrated: number; peak: number }> = {
            spotify: { integrated: -14, peak: -1 },
            apple: { integrated: -16, peak: -1 },
            youtube: { integrated: -14, peak: -1 },
            default: { integrated: -14, peak: -1 },
        };

        const { integrated, peak } = targets[target];

        if (lufs > peak) {
            errors.push({
                code: 'QC_LUFS_TOO_LOUD',
                message: `Track is too loud (${lufs.toFixed(1)} LUFS). Maximum allowed: ${peak} LUFS. Will be rejected by streaming platforms.`,
                severity: 'error',
            });
        } else if (lufs > integrated) {
            warnings.push({
                code: 'QC_LUFS_HIGH',
                message: `Track loudness (${lufs.toFixed(1)} LUFS) exceeds the ${target} target (${integrated} LUFS). It will be normalized down, potentially losing dynamic impact.`,
                severity: 'warning',
            });
        } else if (lufs < integrated - 6) {
            warnings.push({
                code: 'QC_LUFS_LOW',
                message: `Track loudness (${lufs.toFixed(1)} LUFS) is below the ${target} target (${integrated} LUFS). Consider bringing the mix up.`,
                severity: 'warning',
            });
        }

        return lufs;
    }

    // ──────────────────────────────────────────────────────────────
    // Item 235: Apple Digital Masters Badge Qualification
    // ──────────────────────────────────────────────────────────────

    /**
     * Item 235: Check if a track qualifies for the Apple Digital Masters badge.
     *
     * Apple Digital Masters requirements:
     * - Source master: 24-bit minimum bit depth
     * - Sample rate: 96kHz or higher (88.2kHz also accepted)
     * - No limiting or loudness normalization applied to the master
     * - Delivered as 24-bit ALAC or WAV
     *
     * Note: The Web Audio API decodes to float32 at the system sample rate,
     * so bit depth must be reported from file metadata, not the decoded buffer.
     * This method validates the sample rate from the decoded buffer and expects
     * bitDepth to be passed from the file parser.
     */
    static checkAppleDigitalMasters(
        buffer: AudioBuffer,
        bitDepth: number,
        errors: ValidationError[],
        warnings: ValidationWarning[]
    ): boolean {
        let qualifies = true;

        if (bitDepth < 24) {
            errors.push({
                code: 'QC_ADM_BIT_DEPTH',
                message: `Apple Digital Masters requires 24-bit depth. This file is ${bitDepth}-bit. Export your master as 24-bit WAV.`,
                severity: 'error',
            });
            qualifies = false;
        }

        const acceptableSampleRates = [88200, 96000, 176400, 192000];
        if (!acceptableSampleRates.includes(buffer.sampleRate)) {
            if (buffer.sampleRate < 88200) {
                errors.push({
                    code: 'QC_ADM_SAMPLE_RATE',
                    message: `Apple Digital Masters requires 88.2kHz or 96kHz sample rate. This file is ${(buffer.sampleRate / 1000).toFixed(1)}kHz.`,
                    severity: 'error',
                });
                qualifies = false;
            } else {
                warnings.push({
                    code: 'QC_ADM_SAMPLE_RATE_WARNING',
                    message: `Sample rate ${(buffer.sampleRate / 1000).toFixed(1)}kHz is high-res but not a standard ADM rate (88.2 / 96kHz).`,
                    severity: 'warning',
                });
            }
        }

        return qualifies;
    }

    /**
     * Full QC check including LUFS + Apple Digital Masters (Items 234-235).
     * @param buffer The decoded audio buffer
     * @param bitDepth Bit depth from file metadata (16, 24, or 32)
     * @param lufsTarget DSP target for LUFS compliance check
     * @param checkADM Whether to validate Apple Digital Masters eligibility
     */
    static async performFullQC(
        buffer: AudioBuffer,
        options: {
            requirements?: DistributorRequirements['audio'];
            bitDepth?: number;
            lufsTarget?: 'spotify' | 'apple' | 'youtube' | 'default';
            checkADM?: boolean;
        } = {}
    ): Promise<ValidationResult & { lufs?: number; admEligible?: boolean }> {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Standard checks
        this.checkTechnicalSpecs(buffer, options.requirements, errors, warnings);
        this.checkAcoustics(buffer, errors, warnings);

        // Item 234: LUFS
        const lufs = this.checkLUFSCompliance(buffer, errors, warnings, options.lufsTarget || 'default');

        // Item 235: Apple Digital Masters
        let admEligible: boolean | undefined;
        if (options.checkADM && options.bitDepth !== undefined) {
            admEligible = this.checkAppleDigitalMasters(buffer, options.bitDepth, errors, warnings);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            lufs,
            admEligible,
        };
    }
}
