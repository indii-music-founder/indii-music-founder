import log from 'electron-log';
import { ipcMain } from 'electron';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { apiService } from '../services/APIService';
import { AudioLookupSchema } from '../utils/validation';
import { validateSafeAudioPath } from '../utils/file-security';
import { validateSender } from '../utils/ipc-security';
import { accessControlService } from '../security/AccessControlService';
import { masteringService } from '../services/MasteringService';
import { AgentSupervisor } from '../utils/AgentSupervisor';
import os from 'os';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import { z } from 'zod';

// Fix for packing in Electron (files in asar)
const getBinaryPath = (binaryPath: string | null) => {
    if (!binaryPath) return '';
    const fixedPath = binaryPath.replace('app.asar', 'app.asar.unpacked');
    // Log path for debugging production builds
    if (fixedPath !== binaryPath) {
        log.info(`[AudioHandler] Adjusted binary path from ${binaryPath} to ${fixedPath}`);
    }
    return fixedPath;
}

if (ffmpegPath) {
    const fixedFfmpegPath = getBinaryPath(ffmpegPath);
    ffmpeg.setFfmpegPath(fixedFfmpegPath);
    log.info(`[AudioHandler] FFmpeg path set to: ${fixedFfmpegPath}`);
}

if (ffprobePath.path) {
    const fixedFfprobePath = getBinaryPath(ffprobePath.path);
    ffmpeg.setFfprobePath(fixedFfprobePath);
    log.info(`[AudioHandler] FFprobe path set to: ${fixedFfprobePath}`);
}

const calculateFileHash = (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('error', (err: Error) => reject(err));
        stream.on('data', (chunk: Buffer | string) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
};

const YAMNET_URL = 'https://huggingface.co/zeropointnine/yamnet-onnx/resolve/main/yamnet.onnx';

async function ensureYamnetModelExists(): Promise<string | null> {
    const modelDir = path.join(os.homedir(), '.cache', 'indii');
    const modelPath = path.join(modelDir, 'yamnet.onnx');

    if (fs.existsSync(modelPath)) {
        return modelPath;
    }

    log.info(`[AudioHandler] YAMNet model not found at ${modelPath}. Downloading from ${YAMNET_URL}...`);
    try {
        await fs.promises.mkdir(modelDir, { recursive: true });
        
        const response = await fetch(YAMNET_URL, { redirect: 'follow' });
        if (!response.ok) {
            throw new Error(`Failed to download model: ${response.statusText}`);
        }
        if (!response.body) {
            throw new Error('Response body is empty');
        }

        const tempPath = `${modelPath}.tmp`;
        const fileStream = fs.createWriteStream(tempPath);
        
        await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), fileStream);
        await fs.promises.rename(tempPath, modelPath);
        log.info(`[AudioHandler] YAMNet model successfully downloaded to ${modelPath}`);
        return modelPath;
    } catch (error) {
        log.error('[AudioHandler] Failed to download YAMNet model:', error);
        return null;
    }
}

export function registerAudioHandlers() {
    ipcMain.handle('audio:analyze', async (event, filePath) => {
        log.info('Audio analysis requested for:', filePath);

        try {
            validateSender(event);
            const validatedPath = validateSafeAudioPath(filePath);
            
            // SECURITY: Verify Access Authorization
            if (!accessControlService.verifyAccess(validatedPath)) {
                throw new Error(`Security Violation: Access to ${validatedPath} is denied. File was not authorized by user.`);
            }

            const [hash, probeData, pythonResult] = await Promise.all([
                calculateFileHash(validatedPath),
                new Promise<{ format: ffmpeg.FfprobeFormat; streams: ffmpeg.FfprobeStream[] }>((resolve, reject) => {
                    ffmpeg.ffprobe(validatedPath, (err, metadata) => {
                        if (err) reject(err);
                        else resolve({ format: metadata.format, streams: metadata.streams });
                    });
                }),
                (async () => {
                    await ensureYamnetModelExists().catch(err => {
                        log.error('[AudioHandler] Error in ensureYamnetModelExists:', err);
                    });
                    try {
                        return await AgentSupervisor.execute<{
                            status: string;
                            features: Record<string, unknown> | null;
                            semantic: Record<string, unknown> | null;
                        }>('audio', 'audio_analysis.py', [validatedPath]);
                    } catch (err) {
                        log.error('[AudioHandler] Local python analysis failed:', err);
                        return null;
                    }
                })()
            ]);

            log.info("Analysis Complete. Hash:", hash.substring(0, 8) + "...");

            return {
                status: 'success',
                hash,
                metadata: {
                    duration: probeData.format.duration ? Number(probeData.format.duration) : (pythonResult?.features?.duration ?? 0),
                    format: probeData.format.format_name ?? '',
                    bitrate: probeData.format.bit_rate ? Number(probeData.format.bit_rate) : 0
                },
                streams: probeData.streams ?? [],
                features: pythonResult?.features || null,
                semantic: pythonResult?.semantic || null
            };
        } catch (error) {
            log.error("Audio analysis failed:", error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('audio:lookup-metadata', async (event, hash) => {
        log.info('[Main] Metadata lookup requested for hash:', hash);
        try {
            validateSender(event);
            // Schema Validation
            const validatedHash = AudioLookupSchema.parse(hash);

            // In a real app, you might pass the user's auth token here if needed
            // const token = await authService.getToken(); 
            return await apiService.getSongMetadata(validatedHash);
        } catch (error) {
            log.error("[Main] Metadata lookup failed:", error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            throw error;
        }
    });

    ipcMain.handle('audio:transcode', async (event, options) => {
        const { inputPath, outputPath, targetFormat, bitRate, sampleRate } = options;
        log.info(`[Main] Transcoding: ${inputPath} -> ${outputPath} (${targetFormat})`);

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
                        log.info('[Main] Transcoding finished');
                        resolve({ success: true, path: outputPath });
                    })
                    .on('error', (err) => {
                        log.error('[Main] Transcoding failed:', err);
                        resolve({ success: false, error: err.message });
                    })
                    .save(outputPath);
            });
        } catch (error) {
            log.error('[Main] Transcode setup failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('audio:master', async (event, options) => {
        const { inputPath, outputPath, style } = options;
        log.info(`[Main] Mastering: ${inputPath} -> ${outputPath} (Style: ${style})`);

        try {
            validateSender(event);
            return await masteringService.masterAudio(inputPath, outputPath, style);
        } catch (error) {
            log.error('[Main] Audio mastering setup failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
}
