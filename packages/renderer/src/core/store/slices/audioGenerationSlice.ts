import { StateCreator } from 'zustand';
import { audioPersistenceService, AudioMetadata } from '@/services/audio/AudioPersistenceService';
import { logger } from '@/utils/logger';

export type AudioPersistenceStatus = 'saved' | 'pending' | 'failed';

export type AudioLibraryAsset = AudioMetadata & {
    /** Local delivery state. A failed save stays visible so the result is not lost. */
    persistenceStatus?: AudioPersistenceStatus;
    persistenceError?: string;
};

export interface AudioGenerationSlice {
    generatedAssets: AudioLibraryAsset[];
    isAudioLoading: boolean;
    audioError: string | null;

    // Actions
    fetchAudioLibrary: () => Promise<void>;
    /**
     * Legacy in-memory insertion. New generators must use persistGeneratedAsset so
     * they do not present a volatile result as a saved library item.
     */
    addGeneratedAsset: (asset: AudioMetadata) => void;
    persistGeneratedAsset: (asset: AudioMetadata) => Promise<boolean>;
    retryAudioPersistence: (id: string) => Promise<boolean>;
    deleteAudioAsset: (id: string) => Promise<void>;
}

export const createAudioGenerationSlice: StateCreator<AudioGenerationSlice> = (set) => ({
    generatedAssets: [],
    isAudioLoading: false,
    audioError: null,

    fetchAudioLibrary: async () => {
        set({ isAudioLoading: true, audioError: null });
        try {
            const assets = await audioPersistenceService.listUserAudio();
            set({
                generatedAssets: assets.map(asset => ({ ...asset, persistenceStatus: 'saved' as const })),
                isAudioLoading: false,
            });
        } catch (error: unknown) {
            logger.error('[AudioGenSlice] Failed to fetch library:', error);
            set({
                audioError: 'Failed to load audio library',
                isAudioLoading: false
            });
        }
    },

    addGeneratedAsset: (asset: AudioMetadata) => {
        set(state => ({
            generatedAssets: [{ ...asset, persistenceStatus: 'pending' }, ...state.generatedAssets]
        }));
    },

    persistGeneratedAsset: async (asset: AudioMetadata) => {
        set(state => ({
            generatedAssets: [
                { ...asset, persistenceStatus: 'pending', persistenceError: undefined },
                ...state.generatedAssets.filter(existing => existing.id !== asset.id),
            ],
            audioError: null,
        }));

        try {
            await audioPersistenceService.saveAudioMetadata(asset);
            set(state => ({
                generatedAssets: state.generatedAssets.map(existing =>
                    existing.id === asset.id
                        ? { ...existing, persistenceStatus: 'saved', persistenceError: undefined }
                        : existing
                ),
            }));
            return true;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to save generated audio';
            logger.error('[AudioGenSlice] Failed to persist generated audio:', error);
            set(state => ({
                generatedAssets: state.generatedAssets.map(existing =>
                    existing.id === asset.id
                        ? { ...existing, persistenceStatus: 'failed', persistenceError: message }
                        : existing
                ),
                audioError: message,
            }));
            return false;
        }
    },

    retryAudioPersistence: async (id: string) => {
        let asset: AudioMetadata | undefined;
        set(state => {
            const existing = state.generatedAssets.find(candidate => candidate.id === id);
            if (!existing) return state;
            asset = existing;
            return {
                generatedAssets: state.generatedAssets.map(candidate =>
                    candidate.id === id
                        ? { ...candidate, persistenceStatus: 'pending', persistenceError: undefined }
                        : candidate
                ),
                audioError: null,
            };
        });

        if (!asset) return false;
        try {
            await audioPersistenceService.saveAudioMetadata(asset);
            set(state => ({
                generatedAssets: state.generatedAssets.map(candidate =>
                    candidate.id === id
                        ? { ...candidate, persistenceStatus: 'saved', persistenceError: undefined }
                        : candidate
                ),
            }));
            return true;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to save generated audio';
            set(state => ({
                generatedAssets: state.generatedAssets.map(candidate =>
                    candidate.id === id
                        ? { ...candidate, persistenceStatus: 'failed', persistenceError: message }
                        : candidate
                ),
                audioError: message,
            }));
            return false;
        }
    },

    deleteAudioAsset: async (id: string) => {
        try {
            await audioPersistenceService.deleteAudio(id);
            set(state => ({
                generatedAssets: state.generatedAssets.filter(a => a.id !== id)
            }));
        } catch (error: unknown) {
            logger.error('[AudioGenSlice] Failed to delete asset:', error);
            throw error;
        }
    }
});
