import log from 'electron-log';
import { ipcMain } from 'electron';
import { z } from 'zod';
import { validateSender } from '../utils/ipc-security';
import { formatFoundryService } from '../services/FormatFoundryService';

const IngestFileSchema = z.object({
  filePath: z.string().min(1),
});

const FileMetadataSchema = z.object({
  filePath: z.string().min(1),
});

export const registerFoundryHandlers = (): void => {
  ipcMain.handle('foundry:read-file', async (event, filePath: string) => {
    try {
      validateSender(event);
      const validated = IngestFileSchema.parse({ filePath });
      return await formatFoundryService.readTextFile(validated.filePath);
    } catch (error) {
      log.error('[FoundryHandler] foundry:read-file failed:', error);
      throw error;
    }
  });

  ipcMain.handle('foundry:get-metadata', async (event, filePath: string) => {
    try {
      validateSender(event);
      const validated = FileMetadataSchema.parse({ filePath });
      return await formatFoundryService.getFileMetadata(validated.filePath);
    } catch (error) {
      log.error('[FoundryHandler] foundry:get-metadata failed:', error);
      throw error;
    }
  });
};
