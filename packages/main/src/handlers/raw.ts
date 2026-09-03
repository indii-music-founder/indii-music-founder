import log from 'electron-log';
import { ipcMain } from 'electron';
import { z } from 'zod';
import { validateSender } from '../utils/ipc-security';
import { rawConverterService } from '../services/RawConverterService';
import type { RawConvertOptions, RawBatchConvertOptions } from '@indii/shared';

const RawInspectSchema = z.object({
    filePath: z.string().min(1),
});

const RawConvertSchema = z.object({
    inputPath: z.string().min(1),
    outputPath: z.string().optional(),
    compressionMode: z.enum(['lossless-jpeg', 'uncompressed']).optional(),
    embedOriginalRaw: z.boolean().optional(),
    generatePreview: z.boolean().optional(),
    baselineExposureOverride: z.number().optional(),
});

const RawBatchConvertSchema = z.object({
    inputPaths: z.array(z.string().min(1)).min(1),
    outputDirectory: z.string().min(1),
    compressionMode: z.enum(['lossless-jpeg', 'uncompressed']).optional(),
    embedOriginalRaw: z.boolean().optional(),
    concurrency: z.number().int().min(1).max(32).optional(),
});

const RawCancelSchema = z.object({
    jobId: z.string().min(1),
});

const RawVerifySchema = z.object({
    dngPath: z.string().min(1),
    sourcePath: z.string().optional(),
});

export const registerRawHandlers = (): void => {
    ipcMain.handle('raw:inspect', async (event, filePath: string) => {
        try {
            validateSender(event);
            const validated = RawInspectSchema.parse({ filePath });
            return await rawConverterService.inspect(validated.filePath);
        } catch (error) {
            log.error('[RawHandler] raw:inspect failed:', error);
            throw error;
        }
    });

    ipcMain.handle('raw:convert', async (event, options: RawConvertOptions) => {
        try {
            validateSender(event);
            const validated = RawConvertSchema.parse(options);
            return await rawConverterService.convert(validated);
        } catch (error) {
            log.error('[RawHandler] raw:convert failed:', error);
            throw error;
        }
    });

    ipcMain.handle('raw:batch-convert', async (event, options: RawBatchConvertOptions) => {
        try {
            validateSender(event);
            const validated = RawBatchConvertSchema.parse(options);
            return await rawConverterService.convertBatch(validated, progress => {
                if (event.sender && !event.sender.isDestroyed()) {
                    event.sender.send('raw:convert-progress', progress);
                }
            });
        } catch (error) {
            log.error('[RawHandler] raw:batch-convert failed:', error);
            throw error;
        }
    });

    ipcMain.handle('raw:cancel', async (event, jobId: string) => {
        try {
            validateSender(event);
            const validated = RawCancelSchema.parse({ jobId });
            rawConverterService.cancel(validated.jobId);
            return { success: true };
        } catch (error) {
            log.error('[RawHandler] raw:cancel failed:', error);
            throw error;
        }
    });

    ipcMain.handle('raw:verify', async (event, dngPath: string, sourcePath?: string) => {
        try {
            validateSender(event);
            const validated = RawVerifySchema.parse({ dngPath, sourcePath });
            return await rawConverterService.verify(validated.dngPath, validated.sourcePath);
        } catch (error) {
            log.error('[RawHandler] raw:verify failed:', error);
            throw error;
        }
    });

    log.info('[RawHandler] RAW-to-DNG conversion handlers registered.');
};
