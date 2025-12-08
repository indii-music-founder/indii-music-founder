
import { useStore } from '@/core/store';

export const MusicTools = {
    analyze_audio: async (args: { filePath: string }) => {
        if (!window.electronAPI?.audio) {
            return "Error: Audio Engine not available via Electron API.";
        }
        try {
            const result = await window.electronAPI.audio.analyze(args.filePath);
            return JSON.stringify(result, null, 2);
        } catch (e: any) {
            return `Analysis failed: ${e.message}`;
        }
    },

    get_audio_metadata: async (args: { hash: string }) => {
        if (!window.electronAPI?.audio) {
            return "Error: Audio Engine not available.";
        }
        try {
            const metadata = await window.electronAPI.audio.getMetadata(args.hash);
            if (!metadata) return "No metadata found for this hash.";
            return JSON.stringify(metadata, null, 2);
        } catch (e: any) {
            return `Metadata lookup failed: ${e.message}`;
        }
    }
};
