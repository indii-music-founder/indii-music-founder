import type { MasterAudioReference } from '@/services/metadata/types';
import type { CanonicalCoverReference } from '@/services/distribution/CanonicalCoverArtService';

/**
 * ISSUE-1692: the release record Submit Release writes to
 * `proprietaryIngestionReleases`, in the same `metadata` + `assets` shape the
 * Publishing wizard writes, so Distribution lists it and the MCP tools
 * (playlist pitch, canvas render) can ground on it.
 *
 * Only canonical references are stored: storage paths, hashes and
 * fingerprints, never download URLs (they carry tokens and can change).
 * Firestore rejects `undefined`, so optional values are left out, not nulled.
 */
export interface ReleaseCatalogInput {
    ownerId: string;
    orgId?: string | null;
    title: string;
    artist: string;
    trackTitle: string;
    label: string;
    genre: string;
    releaseDate?: string;
    isrc?: string;
    masterAsset: MasterAudioReference;
    durationSeconds?: number;
    coverAsset: CanonicalCoverReference;
}

export function buildReleaseCatalogRecord(input: ReleaseCatalogInput): Record<string, unknown> {
    const releaseDate = input.releaseDate?.trim();
    const isrc = input.isrc?.trim();
    const audio = input.masterAsset.audioProperties;
    const orgId = input.orgId?.trim();

    const metadata: Record<string, unknown> = {
        releaseTitle: input.title,
        trackTitle: input.trackTitle,
        artistName: input.artist,
        labelName: input.label,
        genre: input.genre,
        masterFingerprint: input.masterAsset.masterFingerprint,
        ...(releaseDate ? { releaseDate } : {}),
        ...(isrc ? { isrc } : {}),
        ...(typeof input.durationSeconds === 'number' && Number.isFinite(input.durationSeconds)
            ? { durationSeconds: input.durationSeconds }
            : {}),
    };

    const assets: Record<string, unknown> = {
        audioStoragePath: input.masterAsset.storagePath,
        audioContentHash: input.masterAsset.contentHash,
        masterFingerprint: input.masterAsset.masterFingerprint,
        ...(audio ? {
            audioFormat: audio.container,
            audioSampleRate: audio.sampleRate,
            audioBitDepth: audio.bitDepth,
        } : {}),
        ...(isrc ? { isrc } : {}),
        coverArtStoragePath: input.coverAsset.storage_path,
        coverArtContentHash: input.coverAsset.content_hash,
    };

    return {
        userId: input.ownerId,
        ...(orgId ? { orgId } : {}),
        title: input.title,
        metadata,
        assets,
        distributors: [],
        // The artwork audit reads these top-level fields.
        coverArtStoragePath: input.coverAsset.storage_path,
        coverArtContentHash: input.coverAsset.content_hash,
        coverArtGenerationProvenance: input.coverAsset.generation_provenance,
    };
}
