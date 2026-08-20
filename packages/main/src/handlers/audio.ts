import log from 'electron-log';
import { ipcMain, app } from 'electron';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { apiService } from '../services/APIService';
import { AudioLookupSchema } from '../utils/validation';
import { validateSafeAudioPath, validateSafeAudioOutputPath } from '../utils/file-security';
import { validateSender } from '../utils/ipc-security';
import { accessControlService } from '../security/AccessControlService';
import { masteringService } from '../services/MasteringService';
import os from 'os';

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

interface LoudnessMeasurement {
    integratedLufs: number;
    truePeakDb: number;
}

/** FFmpeg's ebur128 filter implements EBU R128 integrated loudness and true peak. */
const measureLoudness = (filePath: string): Promise<LoudnessMeasurement> => new Promise((resolve, reject) => {
    let stderr = '';
    ffmpeg(filePath)
        .audioFilters('ebur128=peak=true')
        .format('null')
        .output('-')
        .on('stderr', line => { stderr += `${line}\n`; })
        .on('end', () => {
            const integratedMatches = [...stderr.matchAll(/\bI:\s*(-?\d+(?:\.\d+)?)\s*LUFS/g)];
            const integrated = integratedMatches.at(-1);
            const truePeak = stderr.match(/\bTrue peak:\s*\n\s*Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS/) || stderr.match(/\bTPK:\s*(-?\d+(?:\.\d+)?)\s/);
            if (!integrated || !truePeak) {
                reject(new Error('FFmpeg did not return EBU R128 integrated loudness and true-peak metrics.'));
                return;
            }
            resolve({ integratedLufs: Number(integrated[1]), truePeakDb: Number(truePeak[1]) });
        })
        .on('error', reject)
        .run();
});



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

            const [hash, probeData, loudness] = await Promise.all([
                calculateFileHash(validatedPath),
                new Promise<{ format: ffmpeg.FfprobeFormat; streams: ffmpeg.FfprobeStream[] }>((resolve, reject) => {
                    ffmpeg.ffprobe(validatedPath, (err, metadata) => {
                        if (err) reject(err);
                        else resolve({ format: metadata.format, streams: metadata.streams });
                    });
                }),
                measureLoudness(validatedPath).catch(error => {
                    log.warn(`[AudioHandler] EBU R128 measurement unavailable; keeping analysis non-certified: ${error instanceof Error ? error.message : String(error)}`);
                    return null;
                }),
            ]);

            log.info("Generating compressed MP3 proxy for cloud analysis...");
            const tempProxyPath = path.join(os.tmpdir(), `${hash}_proxy.mp3`);
            
            await new Promise<void>((resolve, reject) => {
                ffmpeg(validatedPath)
                    .audioChannels(1)
                    .audioFrequency(32000)
                    .audioBitrate('64k')
                    .format('mp3')
                    .on('end', () => resolve())
                    .on('error', (err) => reject(new Error(`FFmpeg proxy generation failed: ${err.message}`)))
                    .save(tempProxyPath);
            });

            const proxyBuffer = await fs.promises.readFile(tempProxyPath);
            const proxyBase64 = proxyBuffer.toString('base64');
            
            // Clean up the temp file silently
            fs.promises.unlink(tempProxyPath).catch(err => log.warn('Failed to delete temp proxy file:', err));

            log.info(`Analysis Complete. Hash: ${hash.substring(0, 8)}... Proxy Size: ${(proxyBuffer.length / 1024).toFixed(1)} KB`);

            return {
                status: 'success',
                hash,
                metadata: {
                    duration: probeData.format.duration ? Number(probeData.format.duration) : 0,
                    format: probeData.format.format_name ?? '',
                    bitrate: probeData.format.bit_rate ? Number(probeData.format.bit_rate) : 0
                },
                streams: probeData.streams ?? [],
                features: loudness ? {
                    loudness: loudness.integratedLufs,
                    audit: {
                        peakLevel: loudness.truePeakDb,
                        truePeakDb: loudness.truePeakDb,
                        integratedLoudness: loudness.integratedLufs,
                        sampleRate: Number(probeData.streams.find(stream => stream.codec_type === 'audio')?.sample_rate || 0),
                        isStereo: (probeData.streams.find(stream => stream.codec_type === 'audio')?.channels || 0) > 1,
                        rejectionRisks: [],
                        measurementMethod: 'measured',
                        bitDepth: Number(probeData.streams.find(stream => stream.codec_type === 'audio')?.bits_per_raw_sample || probeData.streams.find(stream => stream.codec_type === 'audio')?.bits_per_sample || 0),
                    }
                } : null,
                proxyBase64
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
        try {
            // Destructure INSIDE the try so a null/undefined payload returns
            // the standard { success: false } envelope instead of a raw
            // TypeError escaping the handler.
            const { inputPath, outputPath, targetFormat, bitRate, sampleRate } = options || {};
            log.info(`[Main] Transcoding: ${inputPath} -> ${outputPath} (${targetFormat})`);

            validateSender(event);

            const validatedInputPath = validateSafeAudioPath(inputPath);
            if (!accessControlService.verifyAccess(validatedInputPath)) {
                throw new Error(`Security Violation: Access to ${validatedInputPath} is denied. File was not authorized by user.`);
            }

            const allowedRoots = [os.tmpdir(), process.cwd()];
            try {
                allowedRoots.push(app.getPath('userData'));
            } catch {
                // Testing/Dev fallback
            }

            const validatedOutputPath = validateSafeAudioOutputPath(outputPath, allowedRoots);

            return new Promise((resolve) => {
                let command = ffmpeg(validatedInputPath)
                    .toFormat(targetFormat);

                if (bitRate) command = command.audioBitrate(bitRate);
                if (sampleRate) command = command.audioFrequency(sampleRate);

                command
                    .on('end', () => {
                        log.info('[Main] Transcoding finished');
                        resolve({ success: true, path: validatedOutputPath });
                    })
                    .on('error', (err) => {
                        log.error('[Main] Transcoding failed:', err);
                        resolve({ success: false, error: err.message });
                    })
                    .save(validatedOutputPath);
            });
        } catch (error) {
            log.error('[Main] Transcode setup failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('audio:master', async (event, options) => {
        try {
            const { inputPath, outputPath, style } = options || {};
            log.info(`[Main] Mastering: ${inputPath} -> ${outputPath} (Style: ${style})`);

            validateSender(event);

            const validatedInputPath = validateSafeAudioPath(inputPath);
            if (!accessControlService.verifyAccess(validatedInputPath)) {
                throw new Error(`Security Violation: Access to ${validatedInputPath} is denied. File was not authorized by user.`);
            }

            const allowedRoots = [os.tmpdir(), process.cwd()];
            try {
                allowedRoots.push(app.getPath('userData'));
            } catch {
                // Testing/Dev fallback
            }

            const validatedOutputPath = validateSafeAudioOutputPath(outputPath, allowedRoots);

            return await masteringService.masterAudio(validatedInputPath, validatedOutputPath, style);
        } catch (error) {
            log.error('[Main] Audio mastering setup failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
}
