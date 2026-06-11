import log from 'electron-log';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

export class MasteringService {
    async masterAudio(inputPath: string, outputPath: string, style: string): Promise<{ success: boolean; path?: string; error?: string }> {
        log.info(`[MasteringService] Mastering: ${inputPath} -> ${outputPath} (Style: ${style})`);

        try {
            const getFilterForStyle = (s: string) => {
                const styles: Record<string, string> = {
                    'warm': 'equalizer=f=100:width_type=h:width=200:g=2, equalizer=f=10000:width_type=h:width=2000:g=-2',
                    'punchy': 'compand=attacks=0:points=-80/-90|-40/-40|0/-10|20/-5',
                    'bright': 'equalizer=f=5000:width_type=h:width=1000:g=3'
                };
                return styles[s] || 'anull';
            };
            const filter = getFilterForStyle(style);

            // Ensure output directory exists
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            return new Promise((resolve) => {
                ffmpeg(inputPath)
                    .audioFilters(filter)
                    .on('end', () => {
                        log.info('[MasteringService] Mastering finished');
                        resolve({ success: true, path: outputPath });
                    })
                    .on('error', (err) => {
                        log.error('[MasteringService] Mastering failed:', err);
                        resolve({ success: false, error: err.message });
                    })
                    .save(outputPath);
            });
        } catch (error) {
            log.error('[MasteringService] Audio mastering setup failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
}

export const masteringService = new MasteringService();
