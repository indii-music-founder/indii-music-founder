import { createHash } from 'node:crypto';

import * as admin from 'firebase-admin';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';
import sharp from 'sharp';

const MAX_COVER_ART_BYTES = 50 * 1024 * 1024;

export interface ArtworkRequirementProfile {
    profileId: 'dsp-cover-art-baseline.v1';
    minimumWidth: 3_000;
    minimumHeight: 3_000;
    squareRequired: true;
    allowedFormats: readonly ['jpeg', 'png'];
    allowedColorSpaces: readonly ['srgb', 'rgb'];
}

export const DSP_COVER_ART_BASELINE: ArtworkRequirementProfile = {
    profileId: 'dsp-cover-art-baseline.v1',
    minimumWidth: 3_000,
    minimumHeight: 3_000,
    squareRequired: true,
    allowedFormats: ['jpeg', 'png'],
    allowedColorSpaces: ['srgb', 'rgb'],
};

export interface ReleaseArtworkReference {
    releaseId: string;
    ownerUid: string;
    sourceDocumentReference: string;
    storagePath?: string;
}

export interface InspectedArtwork {
    storagePath: string;
    generation: string;
    sizeBytes: number;
    sha256: string;
    width?: number;
    height?: number;
    format?: string;
    colorSpace?: string;
}

export interface AssetResolutionAudit {
    schemaVersion: 'asset-resolution-audit.v1';
    auditId?: string;
    ownerUid: string;
    releaseId: string;
    status: 'compliant' | 'non_compliant' | 'unknown';
    profile: ArtworkRequirementProfile;
    sourceDocumentReference: string;
    artwork?: InspectedArtwork;
    checks: Array<{ code: string; passed: boolean | null; message: string }>;
    warnings: string[];
    alreadyExists: boolean;
}

export interface AssetAuditRepository {
    findRelease(ownerUid: string, releaseId: string): Promise<ReleaseArtworkReference | undefined>;
    findAudit(auditId: string, ownerUid: string): Promise<AssetResolutionAudit | undefined>;
    persistAudit(audit: AssetResolutionAudit & { auditId: string }): Promise<void>;
}

export interface ArtworkInspector {
    inspect(ownerUid: string, storagePath: string): Promise<InspectedArtwork>;
}

function requiredId(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim() || value.length > 200 || value.includes('/')) {
        throw new TypeError(`${field} is invalid.`);
    }
    return value.trim();
}

function stableId(...parts: string[]): string {
    return createHash('sha256').update(parts.join('\0')).digest('hex');
}

function record(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function releaseStoragePath(data: Record<string, unknown>): string | undefined {
    const assets = record(data.assets);
    const coverArt = record(assets?.coverArt);
    const candidates = [
        data.coverArtStoragePath,
        coverArt?.storagePath,
        coverArt?.path,
        assets?.coverArtStoragePath,
        data.coverArtUrl,
        assets?.coverArtUrl,
    ];
    const candidate = candidates.find(value => typeof value === 'string' && value.trim()) as string | undefined;
    if (!candidate) return undefined;
    if (candidate.startsWith('gs://')) return candidate;
    // Signed/public download URLs are deliberately not fetched. The backend
    // audits only stable Cloud Storage object references, never arbitrary URLs.
    if (/^https?:\/\//i.test(candidate)) return undefined;
    return candidate.replace(/^\/+/, '');
}

export function resolveOwnedArtworkObjectPath(ownerUid: string, reference: string, expectedBucket: string): string {
    let objectPath = reference;
    if (reference.startsWith('gs://')) {
        const slash = reference.indexOf('/', 5);
        if (slash <= 5 || reference.slice(5, slash) !== expectedBucket) {
            throw new Error('Artwork Storage bucket does not match the configured project bucket.');
        }
        objectPath = reference.slice(slash + 1);
    }
    if (objectPath.startsWith('covers/')) {
        const canonicalCover = objectPath.match(/^covers\/([^/]+)\/([a-f0-9]{64})\/original\.(jpe?g|png)$/);
        if (!canonicalCover || canonicalCover[1] !== ownerUid) {
            throw new Error('Artwork canonical cover path is invalid for the authenticated owner.');
        }
        return objectPath;
    }
    const ownerPrefixes = [`users/${ownerUid}/`, `artwork/${ownerUid}/`, `cover-art/${ownerUid}/`, `releases/${ownerUid}/`];
    if (!ownerPrefixes.some(prefix => objectPath.startsWith(prefix))) {
        throw new Error('Artwork Storage path is not scoped to the authenticated owner.');
    }
    return objectPath;
}

function firestoreRepository(firestore: Firestore): AssetAuditRepository {
    return {
        async findRelease(ownerUid, releaseId) {
            const references = [
                firestore.collection('users').doc(ownerUid).collection('releases').doc(releaseId),
                firestore.collection('proprietaryIngestionReleases').doc(releaseId),
                firestore.collection('ddexReleases').doc(releaseId),
                firestore.collection('releases').doc(releaseId),
            ];
            for (const reference of references) {
                const snapshot = await reference.get();
                if (!snapshot.exists) continue;
                const data = snapshot.data() ?? {};
                const recordedOwner = data.userId ?? data.ownerUid;
                if (reference.parent.parent === null && recordedOwner !== ownerUid) continue;
                return {
                    releaseId,
                    ownerUid,
                    sourceDocumentReference: reference.path,
                    ...(releaseStoragePath(data) ? { storagePath: releaseStoragePath(data) } : {}),
                };
            }
            return undefined;
        },
        async findAudit(auditId, ownerUid) {
            const snapshot = await firestore.collection('users').doc(ownerUid)
                .collection('assetAuditReceipts').doc(auditId).get();
            return snapshot.exists ? snapshot.data() as AssetResolutionAudit : undefined;
        },
        async persistAudit(audit) {
            const ownerRef = firestore.collection('users').doc(audit.ownerUid);
            const auditRef = ownerRef.collection('assetAuditReceipts').doc(audit.auditId);
            await firestore.runTransaction(async transaction => {
                const [owner, existing] = await Promise.all([transaction.get(ownerRef), transaction.get(auditRef)]);
                if (!owner.exists) throw new Error('Owner profile no longer exists.');
                if (existing.exists) return;
                transaction.create(auditRef, {
                    ...audit,
                    alreadyExists: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
        },
    };
}

function storageInspector(storage: Storage): ArtworkInspector {
    return {
        async inspect(ownerUid, storagePath) {
            const bucket = storage.bucket();
            const objectPath = resolveOwnedArtworkObjectPath(ownerUid, storagePath, bucket.name);
            const file = bucket.file(objectPath);
            const [metadata] = await file.getMetadata();
            const sizeBytes = Number(metadata.size);
            const generation = String(metadata.generation ?? '');
            if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_COVER_ART_BYTES) {
                throw new Error(`Artwork must be between 1 byte and ${MAX_COVER_ART_BYTES} bytes.`);
            }
            if (!generation) throw new Error('Artwork object generation is unavailable.');
            const [bytes] = await bucket.file(objectPath, { generation }).download();
            const image = await sharp(bytes, { failOn: 'error', limitInputPixels: 100_000_000 }).metadata();
            return {
                storagePath: objectPath,
                generation,
                sizeBytes,
                sha256: createHash('sha256').update(bytes).digest('hex'),
                ...(image.width ? { width: image.width } : {}),
                ...(image.height ? { height: image.height } : {}),
                ...(image.format ? { format: image.format } : {}),
                ...(image.space ? { colorSpace: image.space } : {}),
            };
        },
    };
}

/** Inspect canonical cover-art bytes and persist an immutable evidence receipt. */
export async function auditReleaseArtwork(
    ownerUid: string,
    rawReleaseId: string,
    dependencies: { repository?: AssetAuditRepository; inspector?: ArtworkInspector; firestore?: Firestore; storage?: Storage } = {},
): Promise<AssetResolutionAudit> {
    const releaseId = requiredId(rawReleaseId, 'releaseId');
    const repository = dependencies.repository ?? firestoreRepository(dependencies.firestore ?? getFirestore());
    const release = await repository.findRelease(ownerUid, releaseId);
    if (!release) throw new Error('Release does not exist for the authenticated owner.');
    if (!release.storagePath) {
        return {
            schemaVersion: 'asset-resolution-audit.v1',
            ownerUid,
            releaseId,
            status: 'unknown',
            profile: DSP_COVER_ART_BASELINE,
            sourceDocumentReference: release.sourceDocumentReference,
            checks: [{ code: 'CANONICAL_ARTWORK_REFERENCE', passed: null, message: 'No stable Cloud Storage cover-art reference is recorded.' }],
            warnings: ['A URL or claimed width/height is not byte-level evidence. Upload or link canonical owner-scoped artwork.'],
            alreadyExists: false,
        };
    }
    const inspector = dependencies.inspector ?? storageInspector(dependencies.storage ?? getStorage());
    const artwork = await inspector.inspect(ownerUid, release.storagePath);
    const checks = [
        { code: 'MINIMUM_WIDTH', passed: (artwork.width ?? 0) >= DSP_COVER_ART_BASELINE.minimumWidth, message: `Measured width is ${artwork.width ?? 'unknown'}px; minimum is 3000px.` },
        { code: 'MINIMUM_HEIGHT', passed: (artwork.height ?? 0) >= DSP_COVER_ART_BASELINE.minimumHeight, message: `Measured height is ${artwork.height ?? 'unknown'}px; minimum is 3000px.` },
        { code: 'SQUARE_ASPECT_RATIO', passed: artwork.width !== undefined && artwork.width === artwork.height, message: `Measured dimensions are ${artwork.width ?? 'unknown'}x${artwork.height ?? 'unknown'}.` },
        { code: 'ALLOWED_FORMAT', passed: DSP_COVER_ART_BASELINE.allowedFormats.includes(artwork.format as 'jpeg' | 'png'), message: `Measured format is ${artwork.format ?? 'unknown'}; allowed formats are JPEG and PNG.` },
        { code: 'RGB_COLOR_SPACE', passed: DSP_COVER_ART_BASELINE.allowedColorSpaces.includes(artwork.colorSpace as 'srgb' | 'rgb'), message: `Measured color space is ${artwork.colorSpace ?? 'unknown'}; RGB/sRGB is required.` },
    ];
    const status = checks.every(check => check.passed) ? 'compliant' : 'non_compliant';
    const auditId = `asset_audit_${stableId(ownerUid, releaseId, artwork.sha256, artwork.generation, DSP_COVER_ART_BASELINE.profileId).slice(0, 48)}`;
    const existing = await repository.findAudit(auditId, ownerUid);
    if (existing) return { ...existing, alreadyExists: true };
    const audit: AssetResolutionAudit & { auditId: string } = {
        schemaVersion: 'asset-resolution-audit.v1',
        auditId,
        ownerUid,
        releaseId,
        status,
        profile: DSP_COVER_ART_BASELINE,
        sourceDocumentReference: release.sourceDocumentReference,
        artwork,
        checks,
        warnings: ['This baseline audit does not replace partner-specific conformance or delivery acceptance.'],
        alreadyExists: false,
    };
    await repository.persistAudit(audit);
    return audit;
}
