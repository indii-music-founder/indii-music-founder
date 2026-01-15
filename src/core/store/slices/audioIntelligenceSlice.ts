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
                console.log(`[AudioIntelligenceMask] Cache hit for ${id}`);
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

        } catch (error: any) {
            console.error('[AudioIntelligenceMask] Analysis failed', error);
            set({
                isAnalyzingAudio: false,
                analysisError: error.message || 'Audio analysis failed'
            });
            throw error;
        }
    },

    getAudioProfile: (id: string) => {
        return get().audioProfiles[id];
    }
});
