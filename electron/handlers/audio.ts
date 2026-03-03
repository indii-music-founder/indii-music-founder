import { ipcMain } from 'electron';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { apiService } from '../services/APIService';
import { AudioAnalyzeSchema, AudioLookupSchema } from '../utils/validation';
import { validateSafeAudioPath } from '../utils/file-security';
import { validateSender } from '../utils/ipc-security';
import { accessControlService } from '../security/AccessControlService';

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

            // SECURITY: Verify Access Authorization
            if (!accessControlService.verifyAccess(rawPath)) {
                throw new Error(`Security Violation: Access to ${rawPath} is denied. File was not authorized by user.`);
            }

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

    ipcMain.handle('audio:transcode', async (event, options) => {
        const { inputPath, outputPath, targetFormat, bitRate, sampleRate } = options;
        console.log(`[Main] Transcoding: ${inputPath} -> ${outputPath} (${targetFormat})`);

        try {
            validateSender(event);

            // Security: Ensure output directory exists
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            return new Promise((resolve) => {
                let command = ffmpeg(inputPath)
                    .toFormat(targetFormat);

                if (bitRate) command = command.audioBitrate(bitRate);
                if (sampleRate) command = command.audioFrequency(sampleRate);

                command
                    .on('end', () => {
                        console.log('[Main] Transcoding finished');
                        resolve({ success: true, path: outputPath });
                    })
                    .on('error', (err) => {
                        console.error('[Main] Transcoding failed:', err);
                        resolve({ success: false, error: err.message });
                    })
                    .save(outputPath);
            });
        } catch (error) {
            console.error('[Main] Transcode setup failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('audio:master', async (event, options) => {
        const { inputPath, outputPath, style } = options;
        console.log(`[Main] Mastering: ${inputPath} -> ${outputPath} (Style: ${style})`);

        try {
            validateSender(event);

            // Lazy-load mastering filters to avoid circular dependency
            const { MasteringService } = await import('../../src/services/audio/MasteringService');
            const filter = MasteringService.getFilterForStyle(style);

            // Ensure output directory exists
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            return new Promise((resolve) => {
                ffmpeg(inputPath)
                    .audioFilters(filter)
                    .on('end', () => {
                        console.log('[Main] Mastering finished');
                        resolve({ success: true, path: outputPath });
                    })
                    .on('error', (err) => {
                        console.error('[Main] Mastering failed:', err);
                        resolve({ success: false, error: err.message });
                    })
                    .save(outputPath);
            });
        } catch (error) {
            console.error('[Main] Audio mastering setup failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
}
