import { getDownloadURL, getMetadata, ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

import { functions, storage } from '@/services/firebase';
import type { MasterAudioReference } from '@/services/metadata/types';

interface PersistMasterAudioOptions {
    userId: string;
    masterFingerprint: string;
}

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
    'audio/aac': 'aac',
    'audio/aiff': 'aiff',
    'audio/alac': 'alac',
    'audio/flac': 'flac',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/x-aiff': 'aiff',
    'audio/x-flac': 'flac',
    'audio/x-wav': 'wav',
};

function isObjectNotFound(error: unknown): boolean {
    return typeof error === 'object' && error !== null &&
        'code' in error && error.code === 'storage/object-not-found';
}

export class MasterAudioService {
    async persist(file: File, options: PersistMasterAudioOptions): Promise<MasterAudioReference> {
        if (!file.type.startsWith('audio/')) {
            throw new Error('A valid audio file is required for master ingestion.');
        }
        if (!options.userId.trim()) {
            throw new Error('An authenticated owner is required for master ingestion.');
        }
        if (!options.masterFingerprint.trim()) {
            throw new Error('A master fingerprint is required for master ingestion.');
        }

        const contentHash = await this.sha256(file);
        const extension = EXTENSION_BY_MIME_TYPE[file.type.toLowerCase()] ?? 'audio';
        const storagePath = `masters/${options.userId}/${contentHash}/original.${extension}`;
        const masterRef = ref(storage, storagePath);

        let metadata: Awaited<ReturnType<typeof getMetadata>> | undefined;
        try {
            metadata = await getMetadata(masterRef);
        } catch (error: unknown) {
            if (!isObjectNotFound(error)) throw error;

            try {
                await uploadBytes(masterRef, file, {
                    contentType: file.type,
                    customMetadata: {
                        contentHash,
                        immutable: 'true',
                        masterFingerprint: options.masterFingerprint,
                        ownerId: options.userId,
                        originalFileName: file.name,
                    },
                });
            } catch (uploadError: unknown) {
                // A concurrent identical ingestion can win the create-only race.
                // Re-read the deterministic object before treating that as failure.
                try {
                    metadata = await getMetadata(masterRef);
                } catch {
                    throw uploadError;
                }
            }

            metadata ??= await getMetadata(masterRef);
        }

        const resolvedMasterFingerprint = metadata.customMetadata?.masterFingerprint?.trim() || options.masterFingerprint;
        const verifyMaster = httpsCallable<
            { storagePath: string; expectedSha256: string; masterFingerprint: string },
            { verified: true }
        >(functions, 'verifyMasterAudio');
        await verifyMaster({
            storagePath,
            expectedSha256: contentHash,
            masterFingerprint: resolvedMasterFingerprint,
        });

        return {
            contentHash,
            downloadUrl: await getDownloadURL(masterRef),
            masterFingerprint: resolvedMasterFingerprint,
            mimeType: file.type,
            originalFileName: file.name,
            sizeBytes: file.size,
            storagePath,
            uploadedAt: metadata.timeCreated,
        };
    }

    private async sha256(file: File): Promise<string> {
        const bytes = typeof file.arrayBuffer === 'function'
            ? await file.arrayBuffer()
            : await new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(reader.error ?? new Error('Unable to read master audio bytes.'));
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.readAsArrayBuffer(file);
            });
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest))
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
    }
}

export const masterAudioService = new MasterAudioService();
