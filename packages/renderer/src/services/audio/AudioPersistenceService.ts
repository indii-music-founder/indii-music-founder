/**
 * AudioPersistenceService
 * 
 * Handles Firestore listing and querying for audio assets.
 * Extends the generic FirestoreService for type safety.
 */
import { auth } from '@/services/firebase';
import { FirestoreService } from '@/services/FirestoreService';
import { limit, where } from 'firebase/firestore';
import { CloudStorageService } from '@/services/CloudStorageService';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';
import { logger } from '@/utils/logger';

export interface PersistedAudioMetadata {
    id: string;
    userId: string;
    type: 'soundfx' | 'music' | 'tts';
    prompt: string;
    mimeType: string;
    estimatedDuration: number;
    generatedAt: string;
    storageUrl?: string; // Cloud URL if uploaded
    dataUri?: string;   // Local fallback if small

    // Optional analysis fields
    bpm?: number;
    key?: string;
    energy?: number;
    loudness?: number;

    // Additional type-specific metadata
    genre?: string;
    mood?: string;
    tempo?: string;
    voicePreset?: string;
    fullText?: string;

    // Resolved at read time only. Never written to Firestore.
    playbackUrl?: string;
    playbackError?: string;
}

export class AudioPersistenceService extends FirestoreService<PersistedAudioMetadata> {
    constructor() {
        super('audio_assets');
    }

    private requireUserId(): string {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User not authenticated');
        return userId;
    }

    /**
     * List audio assets for the current user.
     */
    async listUserAudio(count: number = 50): Promise<PersistedAudioMetadata[]> {
        const userId = this.requireUserId();
        const assets = await this.list([
            where('userId', '==', userId),
            limit(count)
        ]);
        const playableAssets = await Promise.all(assets.map(async asset => {
            if (asset.dataUri) return { ...asset, playbackUrl: asset.dataUri };
            if (!asset.storageUrl) return asset;
            const playbackUrl = await resolveStorageUrl(asset.storageUrl);
            if (playbackUrl.startsWith('gs://')) {
                return { ...asset, playbackError: 'Stored audio could not be resolved for playback.' };
            }
            return { ...asset, playbackUrl };
        }));
        return playableAssets.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    }

    /**
     * Save audio metadata to Firestore.
     */
    async saveAudioMetadata(metadata: PersistedAudioMetadata): Promise<void> {
        const userId = this.requireUserId();
        const { playbackUrl: _playbackUrl, playbackError: _playbackError, ...persisted } = metadata;
        await this.set(metadata.id, { ...persisted, userId });
    }

    /**
     * Delete an audio asset, including its cloud storage file.
     */
    async deleteAudio(id: string): Promise<void> {
        const userId = this.requireUserId();
        const metadata = await this.get(id);
        if (!metadata) return;
        if (metadata.userId !== userId) {
            throw new Error('Audio asset does not belong to the current user');
        }
        if (metadata.storageUrl) {
            try {
                await CloudStorageService.deleteStorageUri(metadata.storageUrl);
            } catch (error: unknown) {
                logger.warn('[AudioPersistence] Storage cleanup failed; retaining metadata for retry:', error);
                throw error;
            }
        }
        await this.delete(id);
    }
}

export const audioPersistenceService = new AudioPersistenceService();
export type { PersistedAudioMetadata as AudioMetadata };
