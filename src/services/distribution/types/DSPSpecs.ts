export type AudioFormat = 'wav' | 'flac' | 'alac' | 'aiff' | 'mp3';

export interface DSPDeliverySpec {
    dspId: string;
    dspName: string;
    audio: {
        allowedFormats: AudioFormat[];
        minSampleRate: number;
        recommendedSampleRate: number;
        minBitDepth: number;
        recommendedBitDepth: number;
        targetLUFS: number;
        maxTruePeak: number;
    };
    coverArt: {
        minWidth: number;
        minHeight: number;
        aspectRatio: string;
        allowedFormats: string[];
        colorMode: 'RGB' | 'CMYK';
    };
}

export const DSP_SPECS: Record<string, DSPDeliverySpec> = {
    spotify: {
        dspId: 'spotify',
        dspName: 'Spotify',
        audio: {
            allowedFormats: ['wav', 'flac'],
            minSampleRate: 44100,
            recommendedSampleRate: 44100,
            minBitDepth: 16,
            recommendedBitDepth: 24,
            targetLUFS: -14.0,
            maxTruePeak: -1.0,
        },
        coverArt: {
            minWidth: 3000,
            minHeight: 3000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg', 'jpeg', 'png', 'tiff'],
            colorMode: 'RGB'
        }
    },
    apple_music: {
        dspId: 'apple_music',
        dspName: 'Apple Music',
        audio: {
            allowedFormats: ['wav', 'alac', 'aiff', 'flac'],
            minSampleRate: 44100,
            recommendedSampleRate: 96000,
            minBitDepth: 16,
            recommendedBitDepth: 24,
            targetLUFS: -16.0,
            maxTruePeak: -1.0,
        },
        coverArt: {
            minWidth: 3000,
            minHeight: 3000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg', 'jpeg', 'png'],
            colorMode: 'RGB'
        }
    },
    tidal: {
        dspId: 'tidal',
        dspName: 'TIDAL',
        audio: {
            allowedFormats: ['wav', 'flac', 'alac'],
            minSampleRate: 44100,
            recommendedSampleRate: 96000,
            minBitDepth: 16,
            recommendedBitDepth: 24,
            targetLUFS: -14.0,
            maxTruePeak: -1.0,
        },
        coverArt: {
            minWidth: 3000,
            minHeight: 3000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg', 'jpeg', 'png'],
            colorMode: 'RGB'
        }
    },
    amazon_music: {
        dspId: 'amazon_music',
        dspName: 'Amazon Music',
        audio: {
            allowedFormats: ['wav', 'flac', 'alac'],
            minSampleRate: 44100,
            recommendedSampleRate: 96000,
            minBitDepth: 16,
            recommendedBitDepth: 24,
            targetLUFS: -14.0,
            maxTruePeak: -1.0,
        },
        coverArt: {
            minWidth: 3000,
            minHeight: 3000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg', 'jpeg', 'png'],
            colorMode: 'RGB'
        }
    },
    deezer: {
        dspId: 'deezer',
        dspName: 'Deezer',
        audio: {
            allowedFormats: ['wav', 'flac'],
            minSampleRate: 44100,
            recommendedSampleRate: 44100,
            minBitDepth: 16,
            recommendedBitDepth: 16,
            targetLUFS: -14.0, // or Deezer uses around -15 to -14
            maxTruePeak: -1.0,
        },
        coverArt: {
            minWidth: 3000,
            minHeight: 3000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg', 'jpeg', 'png'],
            colorMode: 'RGB'
        }
    },
    youtube_music: {
        dspId: 'youtube_music',
        dspName: 'YouTube Music',
        audio: {
            allowedFormats: ['wav', 'flac'],
            minSampleRate: 44100,
            recommendedSampleRate: 48000,
            minBitDepth: 16,
            recommendedBitDepth: 24,
            targetLUFS: -14.0,
            maxTruePeak: -1.0,
        },
        coverArt: {
            minWidth: 3000,
            minHeight: 3000,
            aspectRatio: '1:1',
            allowedFormats: ['jpg', 'jpeg', 'png'],
            colorMode: 'RGB'
        }
    }
};

export interface DSPComplianceResult {
    dspId: string;
    dspName: string;
    isCompliant: boolean;
    issues: Array<{
        category: 'audio' | 'coverArt';
        severity: 'error' | 'warning';
        message: string;
        recommendation: string;
    }>;
}

/**
 * Validates extracted audio DNA and assets against specific DSP requirements.
 */
export function validateDSPCompliance(
    dspId: string,
    trackSpecs: {
        lufs?: number;
        truePeak?: number;
        sampleRate?: number;
        bitDepth?: number;
        format?: string
    },
    artSpecs?: {
        width?: number;
        height?: number;
        format?: string;
    }
): DSPComplianceResult {
    const spec = DSP_SPECS[dspId];
    if (!spec) {
        throw new Error(`DSP Config not found for ${dspId}`);
    }

    const issues: DSPComplianceResult['issues'] = [];

    // Audio Validation
    if (trackSpecs.format && !spec.audio.allowedFormats.includes(trackSpecs.format.toLowerCase() as AudioFormat)) {
        issues.push({
            category: 'audio',
            severity: 'error',
            message: `Unsupported audio format: ${trackSpecs.format}`,
            recommendation: `Use one of the supported formats: ${spec.audio.allowedFormats.join(', ')}`
        });
    }

    if (trackSpecs.sampleRate) {
        if (trackSpecs.sampleRate < spec.audio.minSampleRate) {
            issues.push({
                category: 'audio',
                severity: 'error',
                message: `Sample rate too low: ${trackSpecs.sampleRate}Hz`,
                recommendation: `Render audio at minimum ${spec.audio.minSampleRate}Hz (Recommended: ${spec.audio.recommendedSampleRate}Hz)`
            });
        }
    }

    if (trackSpecs.bitDepth) {
        if (trackSpecs.bitDepth < spec.audio.minBitDepth) {
            issues.push({
                category: 'audio',
                severity: 'error',
                message: `Bit depth too low: ${trackSpecs.bitDepth}-bit`,
                recommendation: `Export audio at minimum ${spec.audio.minBitDepth}-bit (Recommended: ${spec.audio.recommendedBitDepth}-bit)`
            });
        }
    }

    if (trackSpecs.lufs !== undefined) {
        const diff = Math.abs(trackSpecs.lufs - spec.audio.targetLUFS);
        if (diff > 1.5) {
            issues.push({
                category: 'audio',
                severity: 'warning',
                message: `LUFS (${trackSpecs.lufs} LUFS) differs significantly from target (${spec.audio.targetLUFS} LUFS)`,
                recommendation: trackSpecs.lufs > spec.audio.targetLUFS ?
                    `Track is too loud and will be penalized/turned down by ${spec.dspName}. Target ${spec.audio.targetLUFS} LUFS.` :
                    `Track is quieter than standard and may sound weak next to other tracks on ${spec.dspName}. Target ${spec.audio.targetLUFS} LUFS.`
            });
        }
    }

    if (trackSpecs.truePeak !== undefined && trackSpecs.truePeak > spec.audio.maxTruePeak) {
        issues.push({
            category: 'audio',
            severity: 'warning',
            message: `True Peak (${trackSpecs.truePeak} dBTP) exceeds maximum safe threshold (${spec.audio.maxTruePeak} dBTP)`,
            recommendation: `Lower the ceiling on your limiter to ${spec.audio.maxTruePeak} dBTP to prevent clipping/distortion during lossy encoding.`
        });
    }

    // Art Validation
    if (artSpecs) {
        if (artSpecs.width && artSpecs.width < spec.coverArt.minWidth) {
            issues.push({
                category: 'coverArt',
                severity: 'error',
                message: `Cover art width too small: ${artSpecs.width}px`,
                recommendation: `Upscale or replace cover art to be exactly or above ${spec.coverArt.minWidth}x${spec.coverArt.minHeight}px`
            });
        }

        if (artSpecs.height && artSpecs.height < spec.coverArt.minHeight) {
            issues.push({
                category: 'coverArt',
                severity: 'error',
                message: `Cover art height too small: ${artSpecs.height}px`,
                recommendation: `Upscale or replace cover art to be exactly or above ${spec.coverArt.minWidth}x${spec.coverArt.minHeight}px`
            });
        }

        if (artSpecs.format && !spec.coverArt.allowedFormats.includes(artSpecs.format.toLowerCase().replace('jpeg', 'jpg'))) {
            issues.push({
                category: 'coverArt',
                severity: 'error',
                message: `Unsupported artwork format: ${artSpecs.format}`,
                recommendation: `Convert artwork to one of the supported formats: ${spec.coverArt.allowedFormats.join(', ')}`
            });
        }
    }

    return {
        dspId,
        dspName: spec.dspName,
        isCompliant: issues.every((i) => i.severity !== 'error'), // Warnings don't block compliance
        issues
    };
}
