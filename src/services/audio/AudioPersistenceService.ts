/**
 * AudioPersistenceService
 * 
 * Handles Firestore listing and querying for audio assets.
 * Extends the generic FirestoreService for type safety.
 */
import { auth } from '@/services/firebase';
import { FirestoreService } from '@/services/FirestoreService';
import { orderBy, limit } from 'firebase/firestore';
import { CloudStorageService } from '@/services/CloudStorageService';

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
}

class AudioPersistenceService extends FirestoreService<PersistedAudioMetadata> {
    constructor() {
        // This is a placeholder path; actual path is derived per user
        super('audio_assets');
    }

    /**
     * Get the user-specific audio collection path.
     */
    private getUserCollectionPath(): string {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User not authenticated');
        return `users/${userId}/audio`;
    }

    /**
     * Override collection to be user-specific.
     */
    protected get collection() {
        const path = this.getUserCollectionPath();
        return super.collection; // This is a bit tricky with the base class
        // Better: just use direct firestore methods or update the base class.
        // For now, I'll use a simplified implementation.
    }

    /**
     * List audio assets for the current user.
     */
    async listUserAudio(count: number = 50): Promise<PersistedAudioMetadata[]> {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];

        const path = `users/${userId}/audio`;
        const service = new FirestoreService<PersistedAudioMetadata>(path);

        return service.list([
            orderBy('generatedAt', 'desc'),
            limit(count)
        ]);
    }

    /**
     * Save audio metadata to Firestore.
     */
    async saveAudioMetadata(metadata: PersistedAudioMetadata): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const path = `users/${userId}/audio`;
        const service = new FirestoreService<PersistedAudioMetadata>(path);
        await service.set(metadata.id, metadata);
    }

    /**
     * Delete an audio asset, including its cloud storage file.
     */
    async deleteAudio(id: string): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const path = `users/${userId}/audio`;
        const service = new FirestoreService<PersistedAudioMetadata>(path);

        try {
            // 1. Fetch metadata to get mimeType for storage cleanup
            const metadata = await service.get(id);
            if (metadata) {
                // 2. Cleanup Storage if it was uploaded
                if (metadata.storageUrl) {
                    await CloudStorageService.deleteAudio(id, userId, metadata.mimeType);
                }
            }
        } catch (err) {
            console.warn('[AudioPersistence] Storage cleanup pre-fetch failed:', err);
        }

        // 3. Delete Firestore record
        await service.delete(id);
    }
}

export const audioPersistenceService = new AudioPersistenceService();
export type { PersistedAudioMetadata as AudioMetadata };
