import { create } from 'zustand';

interface AudioState {
    isPlaying: boolean;
    frequencyData: {
        bass: number;
        mid: number;
        high: number;
        bands: number[];
    };
    setIsPlaying: (playing: boolean) => void;
    setFrequencyData: (data: { bass: number; mid: number; high: number; bands: number[] }) => void;
}

export const audioStore = create<AudioState>((set) => ({
    isPlaying: false,
    frequencyData: { bass: 0, mid: 0, high: 0, bands: new Array(31).fill(0) },
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    setFrequencyData: (data) => set({ frequencyData: data }),
}));

export const useAudioStore = audioStore;
