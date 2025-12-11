import { ipcMain } from 'electron';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import crypto from 'crypto';
import fs from 'fs';
import { apiService } from '../services/APIService';

// Fix for packing in Electron (files in asar)
const getBinaryPath = (binaryPath: string | null) => {
    if (!binaryPath) return '';
    return binaryPath.replace('app.asar', 'app.asar.unpacked');
}

if (ffmpegPath) ffmpeg.setFfmpegPath(getBinaryPath(ffmpegPath));
if (ffprobePath.path) ffmpeg.setFfprobePath(getBinaryPath(ffprobePath.path));

const calculateFileHash = (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('error', (err: Error) => reject(err));
        stream.on('data', (chunk: any) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
};

export function registerAudioHandlers() {
    ipcMain.handle('audio:analyze', async (_, filePath) => {
        console.log('Audio analysis requested for:', filePath);

        try {
            // Parallel execution: Hash + Metadata
            const [hash, metadata] = await Promise.all([
                calculateFileHash(filePath),
                new Promise<any>((resolve, reject) => {
                    ffmpeg.ffprobe(filePath, (err, metadata) => {
                        if (err) reject(err);
                        else resolve(metadata.format);
                    });
                })
            ]);

            console.log("Analysis Complete. Hash:", hash.substring(0, 8) + "...");

            return {
                status: 'success',
                hash,
                metadata: {
                    ...metadata,
                    duration: metadata.duration,
                    format: metadata.format_name,
                    bitrate: metadata.bit_rate
                }
            };
        } catch (error) {
            console.error("Audio analysis failed:", error);
            throw error;
        }
    });

    ipcMain.handle('audio:lookup-metadata', async (_, hash) => {
        console.log('[Main] Metadata lookup requested for hash:', hash);
        try {
            // In a real app, you might pass the user's auth token here if needed
            // const token = await authService.getToken(); 
            return await apiService.getSongMetadata(hash);
        } catch (error) {
            console.error("[Main] Metadata lookup failed:", error);
            throw error;
        }
    });
}
