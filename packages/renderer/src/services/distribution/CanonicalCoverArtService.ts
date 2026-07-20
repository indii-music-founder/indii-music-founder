import { getDownloadURL, getMetadata, ref, uploadBytes } from 'firebase/storage';

import { storage } from '@/services/firebase';

const MAX_COVER_BYTES = 50 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export interface CanonicalCoverReference {
    content_hash: string;
    download_url: string;
    mime_type: 'image/jpeg' | 'image/png';
    original_file_name: string;
    size_bytes: number;
    storage_path: string;
    generation_provenance: {
        source: 'generated' | 'uploaded' | 'not_recorded';
        provider?: string;
        model?: string;
        version?: string;
    };
}

export interface CoverGenerationProvenance {
    provider: string;
    model: string;
    version?: string;
}

function objectNotFound(error: unknown): boolean {
    return typeof error === 'object' && error !== null &&
        'code' in error && error.code === 'storage/object-not-found';
}

function requireOwnerId(value: string): string {
    const ownerId = value.trim();
    if (!ownerId || ownerId.includes('/')) throw new Error('An authenticated owner is required for canonical cover art.');
    return ownerId;
}

function normalizedMimeType(value: string): CanonicalCoverReference['mime_type'] {
    const mimeType = value.split(';', 1)[0]?.trim().toLowerCase();
    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
        throw new Error('Release cover art must be a JPEG or PNG file.');
    }
    return mimeType;
}

function originalFileName(value: string | undefined, mimeType: CanonicalCoverReference['mime_type']): string {
    const fallback = mimeType === 'image/png' ? 'cover.png' : 'cover.jpg';
    const name = value?.trim() || fallback;
    if (name.includes('/') || name.includes('\\') || /[\0\r\n]/.test(name)) return fallback;
    return name.slice(0, 512);
}

async function sha256(bytes: BufferSource): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

function assertExistingMetadata(metadata: Awaited<ReturnType<typeof getMetadata>>, ownerId: string, contentHash: string): void {
    const customMetadata = metadata.customMetadata;
    if (
        customMetadata?.contentHash !== contentHash ||
        customMetadata.ownerId !== ownerId ||
        customMetadata.immutable !== 'true'
    ) {
        throw new Error('The existing canonical cover does not carry the required immutable provenance metadata.');
    }
}

/** Stores selected artwork once under an owner-scoped, content-addressed immutable reference. */
export class CanonicalCoverArtService {
    private async persistBytes(
        rawBytes: ArrayBuffer,
        rawMimeType: string,
        options: { userId: string; originalFileName?: string; generationProvenance?: CoverGenerationProvenance },
    ): Promise<CanonicalCoverReference> {
        const ownerId = requireOwnerId(options.userId);
        const bytes = new Uint8Array(rawBytes);
        const mimeType = normalizedMimeType(rawMimeType);
        if (!bytes.byteLength || bytes.byteLength > MAX_COVER_BYTES) {
            throw new Error('Release cover art must be between 1 byte and 50 MB.');
        }

        const contentHash = await sha256(bytes);
        if (!SHA256_PATTERN.test(contentHash)) throw new Error('Release cover art could not be content-addressed.');
        const extension = mimeType === 'image/png' ? 'png' : 'jpg';
        const storagePath = `covers/${ownerId}/${contentHash}/original.${extension}`;
        const coverRef = ref(storage, storagePath);
        const fileName = originalFileName(options.originalFileName, mimeType);

        try {
            const metadata = await getMetadata(coverRef);
            assertExistingMetadata(metadata, ownerId, contentHash);
        } catch (error) {
            if (!objectNotFound(error)) throw error;
            try {
                await uploadBytes(coverRef, bytes, {
                    contentType: mimeType,
                    customMetadata: {
                        contentHash,
                        immutable: 'true',
                        ownerId,
                        originalFileName: fileName,
                    },
                });
            } catch (uploadError) {
                // The create-only rule permits a concurrent identical upload to
                // win; verify the resulting immutable object before reusing it.
                try {
                    const metadata = await getMetadata(coverRef);
                    assertExistingMetadata(metadata, ownerId, contentHash);
                } catch {
                    throw uploadError;
                }
            }
        }

        return {
            content_hash: contentHash,
            download_url: await getDownloadURL(coverRef),
            mime_type: mimeType,
            original_file_name: fileName,
            size_bytes: bytes.byteLength,
            storage_path: storagePath,
            generation_provenance: options.generationProvenance
                ? { source: 'generated', ...options.generationProvenance }
                : { source: 'not_recorded' },
        };
    }

    /** Content-address a directly selected release cover without first creating a packaging copy. */
    async persistFile(file: File, options: { userId: string; originalFileName?: string; generationProvenance?: CoverGenerationProvenance }): Promise<CanonicalCoverReference> {
        return this.persistBytes(await file.arrayBuffer(), file.type, {
            ...options,
            originalFileName: options.originalFileName ?? file.name,
        });
    }

    async persistFromUrl(sourceUrl: string, options: { userId: string; originalFileName?: string; generationProvenance?: CoverGenerationProvenance }): Promise<CanonicalCoverReference> {
        let response: Response;
        try {
            response = await fetch(sourceUrl, { method: 'GET', redirect: 'error' });
        } catch {
            throw new Error('The selected cover art could not be read. Upload it to your brand assets again before delivery.');
        }
        if (!response.ok) throw new Error(`The selected cover art could not be downloaded (HTTP ${response.status}).`);

        return this.persistBytes(await response.arrayBuffer(), response.headers.get('content-type') || '', options);
    }
}

export const canonicalCoverArtService = new CanonicalCoverArtService();
