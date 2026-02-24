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
     * Checks sample rate, bit depth (simulated), duration, and channels.
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
            const absVal = Math.abs(data[i]);
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
            if (Math.abs(data[i]) > SILENCE_THRESHOLD) break;
            silentSamplesAtStart++;
        }

        // Silence detection at end
        for (let i = data.length - 1; i >= 0; i--) {
            if (Math.abs(data[i]) > SILENCE_THRESHOLD) break;
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
}
