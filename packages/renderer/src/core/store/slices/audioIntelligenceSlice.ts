import { logger } from '@/utils/logger';
import { StateCreator } from 'zustand';
import { AudioIntelligenceProfile } from '@/services/audio/types';
import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';
import { fingerprintService } from '@/services/audio/FingerprintService';

export interface AudioIntelligenceSlice {
    audioProfiles: Record<string, AudioIntelligenceProfile>;
    isAnalyzingAudio: boolean;
    analysisError: string | null;

    // Actions
    analyzeAudio: (file: File) => Promise<AudioIntelligenceProfile>;
    getAudioProfile: (id: string) => AudioIntelligenceProfile | undefined;
    invalidateAudioProfile: (id: string) => void;
    updateAudioProfile: (id: string, updates: Partial<AudioIntelligenceProfile>) => void;
    clearAudioProfiles: () => void;
}

export const createAudioIntelligenceSlice: StateCreator<AudioIntelligenceSlice> = (set, get) => ({
    audioProfiles: {},
    isAnalyzingAudio: false,
    analysisError: null,

    analyzeAudio: async (file: File) => {
        set({ isAnalyzingAudio: true, analysisError: null });
        try {
            // 1. Generate Fingerprint (ID)
            const id = await fingerprintService.generateFingerprint(file);
            if (!id) throw new Error('Could not generate fingerprint for file');

            // 2. Check Cache
            const existing = get().audioProfiles[id];
            if (existing) {
                logger.debug(`[AudioIntelligenceMask] Cache hit for ${id}`);
                set({ isAnalyzingAudio: false });
                return existing;
            }

            // 3. Analyze
            const profile = await audioIntelligence.analyze(file);

            // 4. Store
            set(state => ({
                audioProfiles: {
                    ...state.audioProfiles,
                    [profile.id]: profile
                },
                isAnalyzingAudio: false
            }));

            return profile;

        } catch (error: unknown) {
            logger.error('[AudioIntelligenceMask] Analysis failed', error);
            const message = error instanceof Error ? error.message : 'Audio analysis failed';
            set({
                isAnalyzingAudio: false,
                analysisError: message
            });
            throw error;
        }
    },

    getAudioProfile: (id: string) => {
        return get().audioProfiles[id];
    },

    invalidateAudioProfile: (id: string) => {
        set(state => {
            const next = { ...state.audioProfiles };
            delete next[id];
            return { audioProfiles: next };
        });
        logger.debug(`[AudioIntelligenceSlice] Invalidated profile for ${id}`);
    },

    updateAudioProfile: (id: string, updates: Partial<AudioIntelligenceProfile>) => {
        set(state => {
            const current = state.audioProfiles[id];
            if (!current) return state;
            return {
                audioProfiles: {
                    ...state.audioProfiles,
                    [id]: { ...current, ...updates }
                }
            };
        });
        logger.debug(`[AudioIntelligenceSlice] Updated profile for ${id}`);
    },

    clearAudioProfiles: () => {
        set({ audioProfiles: {} });
        logger.debug('[AudioIntelligenceSlice] Cleared all cached audio profiles');
    }
});
