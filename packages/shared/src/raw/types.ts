/**
 * Shared types for indii RAW Converter
 */

export type RawCompressionMode = 'lossless-jpeg' | 'uncompressed';

export interface RawCfaInfo {
    pattern: 'RGGB' | 'BGGR' | 'GRBG' | 'GBRG';
    repeatRows: number;
    repeatCols: number;
    blackLevel: number;
    whiteLevel: number;
}

export interface RawMetadata {
    make: string;
    model: string;
    uniqueCameraModel?: string;
    orientation: number;
    iso?: number;
    exposureTime?: number;
    fNumber?: number;
    focalLength?: number;
    lensModel?: string;
    dateTimeOriginal?: string;
    baselineExposure?: number;
    asShotNeutral?: [number, number, number];
}

export interface RawInspectResult {
    filePath: string;
    isSupported: boolean;
    format: string;
    make: string;
    model: string;
    width: number;
    height: number;
    activeArea: [number, number, number, number];
    bitDepth: number;
    cfa: RawCfaInfo;
    compression: string;
    hasEmbeddedPreview: boolean;
    previewDimensions?: [number, number];
    metadata: RawMetadata;
    supportedReason?: string;
}

export interface RawConvertOptions {
    inputPath: string;
    outputPath?: string;
    compressionMode?: RawCompressionMode;
    embedOriginalRaw?: boolean;
    generatePreview?: boolean;
    baselineExposureOverride?: number;
}

export interface RawConvertResult {
    success: boolean;
    inputPath: string;
    outputPath: string;
    inputSizeBytes: number;
    outputSizeBytes: number;
    compressionRatio: number;
    durationMs: number;
    cfaSampleHash: string;
    metadata: RawMetadata;
    error?: string;
}

export interface RawBatchConvertOptions {
    inputPaths: string[];
    outputDirectory: string;
    compressionMode?: RawCompressionMode;
    embedOriginalRaw?: boolean;
    concurrency?: number;
}

export interface RawBatchProgressItem {
    filePath: string;
    fileName: string;
    status: 'queued' | 'converting' | 'completed' | 'failed';
    progressPercent: number;
    outputSizeBytes?: number;
    error?: string;
}

export type RawBatchItemProgress = RawBatchProgressItem;

export interface RawBatchProgress {
    jobId: string;
    totalFiles: number;
    completedFiles: number;
    failedFiles: number;
    currentFile?: string;
    overallPercent: number;
    items: RawBatchProgressItem[];
}

export interface RawBatchResult {
    jobId: string;
    success: boolean;
    totalFiles: number;
    succeededCount: number;
    failedCount: number;
    totalInputBytes: number;
    totalOutputBytes: number;
    totalDurationMs: number;
    results: RawConvertResult[];
}

export interface RawVerifyResult {
    valid: boolean;
    filePath: string;
    dngVersion: string;
    width: number;
    height: number;
    cfaPattern: string;
    blackLevel: number;
    whiteLevel: number;
    cfaSampleHash: string;
    identicalToSource?: boolean;
    differingSampleCount?: number;
    metadataIssues: string[];
}
