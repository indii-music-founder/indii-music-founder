/**
 * Base Distributor Adapter
 * Abstract base class for all distributor integrations
 */

import type { GoldenMetadata } from '@/services/metadata/types';
import type { ValidationResult, DateRange } from '@/services/ddex/types/common';
import type {
  DistributorId,
  DistributorRequirements,
  DistributorCredentials,
  DistributorEarnings,
  ReleaseAssets,
  ReleaseResult,
  ReleaseStatus,
  IDistributorAdapter,
} from '../types/distributor';

export abstract class BaseDistributorAdapter implements IDistributorAdapter {
  abstract readonly id: DistributorId;
  abstract readonly name: string;
  abstract readonly requirements: DistributorRequirements;

  protected credentials: DistributorCredentials | null = null;
  protected connected = false;

  // Connection methods
  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  async connect(credentials: DistributorCredentials): Promise<void> {
    this.credentials = credentials;
    await this.validateConnection();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.credentials = null;
    this.connected = false;
  }

  // Abstract methods to be implemented by each distributor
  protected abstract validateConnection(): Promise<void>;

  abstract createRelease(
    metadata: GoldenMetadata,
    assets: ReleaseAssets
  ): Promise<ReleaseResult>;

  abstract updateRelease(
    releaseId: string,
    updates: Partial<GoldenMetadata>
  ): Promise<ReleaseResult>;

  abstract getReleaseStatus(releaseId: string): Promise<ReleaseStatus>;

  abstract takedownRelease(releaseId: string): Promise<ReleaseResult>;

  abstract getEarnings(
    releaseId: string,
    period: DateRange
  ): Promise<DistributorEarnings>;

  abstract getAllEarnings(period: DateRange): Promise<DistributorEarnings[]>;

  // Common validation methods
  async validateMetadata(metadata: GoldenMetadata): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];
    const reqs = this.requirements.metadata;

    // Check required fields
    if (reqs.requiredFields.includes('trackTitle') && !metadata.trackTitle) {
      errors.push({
        code: 'MISSING_TITLE',
        message: 'Track title is required',
        field: 'trackTitle',
        severity: 'error',
      });
    }

    if (reqs.requiredFields.includes('artistName') && !metadata.artistName) {
      errors.push({
        code: 'MISSING_ARTIST',
        message: 'Artist name is required',
        field: 'artistName',
        severity: 'error',
      });
    }

    if (reqs.isrcRequired && !metadata.isrc) {
      errors.push({
        code: 'MISSING_ISRC',
        message: `ISRC is required for ${this.name}`,
        field: 'isrc',
        severity: 'error',
      });
    }

    if (reqs.genreRequired && !metadata.genre) {
      errors.push({
        code: 'MISSING_GENRE',
        message: 'Genre is required',
        field: 'genre',
        severity: 'error',
      });
    }

    if (!metadata.labelName) {
      errors.push({
        code: 'MISSING_LABEL',
        message: 'Label name is required',
        field: 'labelName',
        severity: 'error',
      });
    }

    // Check field lengths
    if (
      metadata.trackTitle &&
      metadata.trackTitle.length > reqs.maxTitleLength
    ) {
      errors.push({
        code: 'TITLE_TOO_LONG',
        message: `Title exceeds ${reqs.maxTitleLength} characters`,
        field: 'trackTitle',
        severity: 'error',
      });
    }

    if (
      metadata.artistName &&
      metadata.artistName.length > reqs.maxArtistNameLength
    ) {
      errors.push({
        code: 'ARTIST_NAME_TOO_LONG',
        message: `Artist name exceeds ${reqs.maxArtistNameLength} characters`,
        field: 'artistName',
        severity: 'error',
      });
    }

    // Check royalty splits sum to 100%
    if (metadata.splits && metadata.splits.length > 0) {
      const totalSplit = metadata.splits.reduce((sum, s) => sum + s.percentage, 0);
      if (Math.abs(totalSplit - 100) > 0.1) {
        errors.push({
          code: 'INVALID_SPLITS',
          message: `Royalty splits must sum to 100% (currently ${totalSplit}%)`,
          field: 'splits',
          severity: 'error',
        });
      }
    }

    // Check sample clearance
    if (metadata.containsSamples && metadata.samples) {
      const unclearedSamples = metadata.samples.filter((s) => !s.cleared);
      if (unclearedSamples.length > 0) {
        errors.push({
          code: 'UNCLEARED_SAMPLES',
          message: `${unclearedSamples.length} sample(s) not cleared`,
          field: 'samples',
          severity: 'error',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateAssets(assets: ReleaseAssets): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];
    const reqs = this.requirements;

    // Validate cover art
    const { coverArt } = assets;
    if (coverArt.width < reqs.coverArt.minWidth) {
      errors.push({
        code: 'COVER_WIDTH_TOO_SMALL',
        message: `Cover art width must be at least ${reqs.coverArt.minWidth}px (got ${coverArt.width}px)`,
        field: 'coverArt.width',
        severity: 'error',
      });
    }

    if (coverArt.height < reqs.coverArt.minHeight) {
      errors.push({
        code: 'COVER_HEIGHT_TOO_SMALL',
        message: `Cover art height must be at least ${reqs.coverArt.minHeight}px (got ${coverArt.height}px)`,
        field: 'coverArt.height',
        severity: 'error',
      });
    }

    if (coverArt.width !== coverArt.height) {
      errors.push({
        code: 'COVER_NOT_SQUARE',
        message: 'Cover art must be square (1:1 aspect ratio)',
        field: 'coverArt',
        severity: 'error',
      });
    }

    if (coverArt.sizeBytes > reqs.coverArt.maxSizeBytes) {
      errors.push({
        code: 'COVER_FILE_TOO_LARGE',
        message: `Cover art file exceeds ${reqs.coverArt.maxSizeBytes / 1024 / 1024}MB`,
        field: 'coverArt.size',
        severity: 'error',
      });
    }

    // Validate audio
    const audioFile = (assets.audioFiles && assets.audioFiles.length > 0) ? assets.audioFiles[0] : assets.audioFile;
    if (!audioFile) {
      errors.push({
        code: 'MISSING_AUDIO',
        message: 'At least one audio file is required',
        field: 'audioFiles',
        severity: 'error',
      });
      return { isValid: false, errors, warnings };
    }

    if (!reqs.audio.allowedFormats.includes(audioFile.format)) {
      errors.push({
        code: 'INVALID_AUDIO_FORMAT',
        message: `Audio format ${audioFile.format} not supported. Use: ${reqs.audio.allowedFormats.join(', ')}`,
        field: 'audioFile.format',
        severity: 'error',
      });
    }

    if (audioFile.sampleRate < reqs.audio.minSampleRate) {
      errors.push({
        code: 'SAMPLE_RATE_TOO_LOW',
        message: `Sample rate must be at least ${reqs.audio.minSampleRate}Hz`,
        field: 'audioFile.sampleRate',
        severity: 'error',
      });
    }

    if (audioFile.bitDepth < reqs.audio.minBitDepth) {
      errors.push({
        code: 'BIT_DEPTH_TOO_LOW',
        message: `Bit depth must be at least ${reqs.audio.minBitDepth}-bit`,
        field: 'audioFile.bitDepth',
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Helper to ensure connection
  protected ensureConnected(): void {
    if (!this.connected || !this.credentials) {
      throw new Error(`Not connected to ${this.name}`);
    }
  }
}
