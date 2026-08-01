import { getDownloadURL, getMetadata, ref, uploadBytesResumable } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

import { functions, storage } from '@/services/firebase';
import type { MasterAudioReference } from '@/services/metadata/types';
import { inspectCanonicalMaster } from './MasterAudioValidation';

interface PersistMasterAudioOptions {
    userId: string;
    masterFingerprint: string;
    signal?: AbortSignal;
}

function isObjectNotFound(error: unknown): boolean {
    return typeof error === 'object' && error !== null &&
        'code' in error && error.code === 'storage/object-not-found';
}

export class MasterAudioService {
    async persist(file: File, options: PersistMasterAudioOptions): Promise<MasterAudioReference> {
        if (!file || file.size <= 0) {
            throw new Error('A non-empty audio file is required for master ingestion.');
        }
        if (!options.userId.trim()) {
            throw new Error('An authenticated owner is required for master ingestion.');
        }
        if (!options.masterFingerprint.trim()) {
            throw new Error('A master fingerprint is required for master ingestion.');
        }
        if (options.signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        const { audioProperties, contentHash } = await inspectCanonicalMaster(file);
        const extension = audioProperties.container;
        const canonicalMimeType = extension === 'flac' ? 'audio/flac' : 'audio/wav';
        const storagePath = `masters/${options.userId}/${contentHash}/original.${extension}`;
        const masterRef = ref(storage, storagePath);

        let metadata: Awaited<ReturnType<typeof getMetadata>> | undefined;
        try {
            metadata = await getMetadata(masterRef);
        } catch (error: unknown) {
            if (!isObjectNotFound(error)) throw error;

            try {
                const uploadTask = uploadBytesResumable(masterRef, file, {
                    contentType: canonicalMimeType,
                    customMetadata: {
                        bitDepth: String(audioProperties.bitDepth),
                        channels: String(audioProperties.channels),
                        codec: audioProperties.codec,
                        container: audioProperties.container,
                        contentHash,
                        immutable: 'true',
                        masterFingerprint: options.masterFingerprint,
                        ownerId: options.userId,
                        originalFileName: file.name,
                        sampleRate: String(audioProperties.sampleRate),
                    },
                });

                if (options.signal) {
                    options.signal.addEventListener('abort', () => {
                        uploadTask.cancel();
                    });
                }

                await uploadTask;
            } catch (uploadError: unknown) {
                // A concurrent identical ingestion can win the create-only race.
                // Re-read the deterministic object before treating that as failure.
                if (options.signal?.aborted) {
                    throw new DOMException('Aborted', 'AbortError');
                }
                try {
                    metadata = await getMetadata(masterRef);
                } catch {
                    throw uploadError;
                }
            }

            metadata ??= await getMetadata(masterRef);
        }

        const resolvedMasterFingerprint = metadata.customMetadata?.masterFingerprint?.trim() || options.masterFingerprint;
        const queueProfiling = httpsCallable<
            { storagePath: string; masterFingerprint: string },
            {
                success: true;
                status: 'QUEUED_FOR_DSP_PROFILING';
                masterFingerprint: string;
                contentHash: string;
                generation: string;
            }
        >(functions, 'processAudioIngestion');
        const profiling = await queueProfiling({
            storagePath,
            masterFingerprint: resolvedMasterFingerprint,
        });
        if (
            profiling.data.contentHash !== contentHash ||
            profiling.data.masterFingerprint !== resolvedMasterFingerprint ||
            !profiling.data.generation
        ) {
            throw new Error('Server profiling receipt does not match the canonical master identity.');
        }

        return {
            audioProperties,
            contentHash,
            downloadUrl: await getDownloadURL(masterRef),
            generation: profiling.data.generation,
            masterFingerprint: resolvedMasterFingerprint,
            mimeType: canonicalMimeType,
            originalFileName: file.name,
            sizeBytes: file.size,
            storagePath,
            uploadedAt: metadata.timeCreated,
        };
    }

}

export const masterAudioService = new MasterAudioService();
