import { toast } from '@/core/context/ToastContext';

export type MasteringStyle = 'hip_hop' | 'lo_fi' | 'pop' | 'electronic' | 'vocal_focus';

export interface MasteringOptions {
    inputPath: string;
    outputPath: string;
    style: MasteringStyle;
    targetLoudness?: number; // e.g. -14 LUFS for Spotify
}

export class MasteringService {
    /**
     * Apply a mastering preset to an audio file.
     * Uses native Electron IPC to access FFmpeg filters.
     */
    async master(options: MasteringOptions): Promise<boolean> {
        console.info(`[MasteringService] Starting mastering for: ${options.inputPath} (Style: ${options.style})`);

        try {
            if (typeof window === 'undefined' || !window.electronAPI?.audio?.master) {
                console.warn('[MasteringService] Native mastering engine not found.');
                // For web/preview mode, we'll just mock it or wait for server-side
                return false;
            }

            const result = await window.electronAPI.audio.master(options);

            if (result.success) {
                toast.success(`Mastering complete! Output: ${options.outputPath}`);
                return true;
            } else {
                toast.error(`Mastering failed: ${result.error}`);
                return false;
            }
        } catch (error) {
            console.error('[MasteringService] Mastering failed:', error);
            toast.error('Audio mastering failed.');
            return false;
        }
    }

    /**
     * Get the filter string for a given mastering style.
     * These are FFmpeg complex filter chains.
     */
    static getFilterForStyle(style: MasteringStyle): string {
        switch (style) {
            case 'hip_hop':
                // Boost lows, slight compression, increase loudness
                return 'equalizer=f=60:width_type=h:width=50:g=3,compand=0.3|0.3:1|1:-90/-60|-60/-40|-40/-30|-20/-20:6:0:-90:0.2,loudnorm=I=-14:TP=-1.5:LRA=7';
            case 'lo_fi':
                // High-shelf cut, warmth in mids, crackle/tape feel (simplified)
                return 'equalizer=f=12000:width_type=h:width=1000:g=-6,aecho=0.8:0.88:60:0.4,loudnorm=I=-16:TP=-2:LRA=11';
            case 'pop':
                // Bright highs, mid presence, tight compression
                return 'equalizer=f=12000:width_type=h:width=2000:g=2,compand=0.3|0.3:0.8|0.8:-90/-60|-60/-40|-40/-20:6:0:-90:0.1,loudnorm=I=-12:TP=-1.0:LRA=5';
            case 'electronic':
                // Sub boost, sidechain-like compression feel
                return 'equalizer=f=50:width_type=h:width=40:g=4,loudnorm=I=-11:TP=-0.1:LRA=6';
            case 'vocal_focus':
                // Mid boost (2k-5k), de-esser like cut (8k)
                return 'equalizer=f=3500:width_type=h:width=1000:g=2,equalizer=f=8000:width_type=h:width=500:g=-3,loudnorm=I=-14:TP=-1.5:LRA=8';
            default:
                return 'loudnorm=I=-14:TP=-1.5:LRA=7';
        }
    }
}

export const masteringService = new MasteringService();
