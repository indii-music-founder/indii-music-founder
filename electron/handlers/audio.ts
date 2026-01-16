import { ipcMain } from 'electron';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import crypto from 'crypto';
import fs from 'fs';
import { apiService } from '../services/APIService';
import { AudioAnalyzeSchema, AudioLookupSchema } from '../utils/validation';
import { validateSender } from '../utils/ipc-security';
import { validateSafeAudioPath } from '../utils/file-security';
import { z } from 'zod';

// Fix for packing in Electron (files in asar)
const getBinaryPath = (binaryPath: string | null) => {
    if (!binaryPath) return '';
    const fixedPath = binaryPath.replace('app.asar', 'app.asar.unpacked');
    // Log path for debugging production builds
    if (fixedPath !== binaryPath) {
        console.log(`[AudioHandler] Adjusted binary path from ${binaryPath} to ${fixedPath}`);
    }
    return fixedPath;
}

if (ffmpegPath) {
    const fixedFfmpegPath = getBinaryPath(ffmpegPath);
    ffmpeg.setFfmpegPath(fixedFfmpegPath);
    console.log(`[AudioHandler] FFmpeg path set to: ${fixedFfmpegPath}`);
}

if (ffprobePath.path) {
    const fixedFfprobePath = getBinaryPath(ffprobePath.path);
    ffmpeg.setFfprobePath(fixedFfprobePath);
    console.log(`[AudioHandler] FFprobe path set to: ${fixedFfprobePath}`);
}

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
    ipcMain.handle('audio:analyze', async (event, filePath) => {
        console.log('Audio analysis requested for:', filePath);

        try {
            validateSender(event);
            // Validation
            const rawPath = AudioAnalyzeSchema.parse(filePath);

            // SECURITY: Validate Path (Symlinks, System Roots, Hidden Files)
            const validatedPath = validateSafeAudioPath(rawPath);

            // Parallel execution: Hash + Metadata
            const [hash, metadata] = await Promise.all([
                calculateFileHash(validatedPath),
                new Promise<any>((resolve, reject) => {
                    ffmpeg.ffprobe(validatedPath, (err, metadata) => {
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
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            throw error;
        }
    });

    ipcMain.handle('audio:lookup-metadata', async (event, hash) => {
        console.log('[Main] Metadata lookup requested for hash:', hash);
        try {
             validateSender(event);
             // Schema Validation
             const validatedHash = AudioLookupSchema.parse(hash);

            // In a real app, you might pass the user's auth token here if needed
            // const token = await authService.getToken(); 
            return await apiService.getSongMetadata(validatedHash);
        } catch (error) {
            console.error("[Main] Metadata lookup failed:", error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            throw error;
        }
    });
}
