import { StateCreator } from 'zustand';
import { HistoryItem } from '@/core/types/history';

export interface AudioPlayerSlice {
    currentTrack: HistoryItem | null;
    isPlaying: boolean;
    volume: number;
    currentTime: number;
    duration: number;
    isPIPVisible: boolean;
    frequencyData: {
        bass: number;
        lowMid: number;
        mid: number;
        highMid: number;
        treble: number;
        bands: number[];
    };

    playTrack: (track: HistoryItem) => void;
    pauseTrack: () => void;
    resumeTrack: () => void;
    stopTrack: () => void;
    updatePlaybackProgress: (currentTime: number, duration: number) => void;
    setFrequencyData: (data: Partial<AudioPlayerSlice['frequencyData']>) => void;
    setVolume: (volume: number) => void;
    togglePIP: (visible: boolean) => void;
}

export const createAudioPlayerSlice: StateCreator<AudioPlayerSlice> = (set) => ({
    currentTrack: null,
    isPlaying: false,
    volume: 0.8,
    currentTime: 0,
    duration: 0,
    isPIPVisible: false,
    frequencyData: {
        bass: 0,
        lowMid: 0,
        mid: 0,
        highMid: 0,
        treble: 0,
        bands: new Array(31).fill(0),
    },

    playTrack: (track: HistoryItem) => {
        set({ currentTrack: track, isPlaying: true, isPIPVisible: true, currentTime: 0 });
    },
    pauseTrack: () => set({ isPlaying: false }),
    resumeTrack: () => set({ isPlaying: true }),
    stopTrack: () => set({
        currentTrack: null,
        isPlaying: false,
        isPIPVisible: false,
        currentTime: 0,
        duration: 0,
        frequencyData: {
            bass: 0,
            lowMid: 0,
            mid: 0,
            highMid: 0,
            treble: 0,
            bands: new Array(31).fill(0),
        }
    }),
    updatePlaybackProgress: (currentTime, duration) => set({ currentTime, duration }),
    setFrequencyData: (data) => set((state) => ({
        frequencyData: { ...state.frequencyData, ...data }
    })),
    setVolume: (volume) => set({ volume }),
    togglePIP: (visible) => set({ isPIPVisible: visible })
});
