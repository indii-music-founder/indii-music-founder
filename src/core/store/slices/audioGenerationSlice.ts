import { StateCreator } from 'zustand';
import { audioPersistenceService, AudioMetadata } from '@/services/audio/AudioPersistenceService';
import { logger } from '@/utils/logger';

export interface AudioGenerationSlice {
    generatedAssets: AudioMetadata[];
    isAudioLoading: boolean;
    audioError: string | null;

    // Actions
    fetchAudioLibrary: () => Promise<void>;
    addGeneratedAsset: (asset: AudioMetadata) => void;
    deleteAudioAsset: (id: string) => Promise<void>;
}

export const createAudioGenerationSlice: StateCreator<AudioGenerationSlice> = (set, get) => ({
    generatedAssets: [],
    isAudioLoading: false,
    audioError: null,

    fetchAudioLibrary: async () => {
        set({ isAudioLoading: true, audioError: null });
        try {
            const assets = await audioPersistenceService.listUserAudio();
            set({ generatedAssets: assets, isAudioLoading: false });
        } catch (error) {
            logger.error('[AudioGenSlice] Failed to fetch library:', error);
            set({
                audioError: 'Failed to load audio library',
                isAudioLoading: false
            });
        }
    },

    addGeneratedAsset: (asset: AudioMetadata) => {
        set(state => ({
            generatedAssets: [asset, ...state.generatedAssets]
        }));
    },

    deleteAudioAsset: async (id: string) => {
        try {
            await audioPersistenceService.deleteAudio(id);
            set(state => ({
                generatedAssets: state.generatedAssets.filter(a => a.id !== id)
            }));
        } catch (error) {
            logger.error('[AudioGenSlice] Failed to delete asset:', error);
            throw error;
        }
    }
});
