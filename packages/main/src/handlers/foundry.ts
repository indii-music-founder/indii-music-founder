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

const GrantSessionSchema = z.object({
  sessionId: z.string().min(1),
  ownerUserId: z.string().min(1),
  ttlMs: z.number().positive().optional(),
});

const RevokeGrantSchema = z.object({
  sessionId: z.string().min(1),
});

const SaveHypothesisSchema = z.object({
  sessionId: z.string().min(1),
  formatId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  ledgerJson: z.string().min(1),
});

const LoadHypothesisSchema = z.object({
  formatId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
});

const BookStatementSchema = z.object({
  sessionId: z.string().min(1),
  statementId: z.string().min(1),
  normalizedReportJson: z.string().min(1),
});

export const registerFoundryHandlers = (): void => {
  ipcMain.handle('foundry:grant-session', async (event, payload: unknown) => {
    try {
      validateSender(event);
      const validated = GrantSessionSchema.parse(payload);
      return formatFoundryService.grantSession(validated.sessionId, validated.ownerUserId, validated.ttlMs);
    } catch (error) {
      log.error('[FoundryHandler] foundry:grant-session failed:', error);
      throw error;
    }
  });

  ipcMain.handle('foundry:revoke-grant', async (event, payload: unknown) => {
    try {
      validateSender(event);
      const validated = RevokeGrantSchema.parse(payload);
      formatFoundryService.revokeGrant(validated.sessionId);
      return { success: true };
    } catch (error) {
      log.error('[FoundryHandler] foundry:revoke-grant failed:', error);
      throw error;
    }
  });

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

  ipcMain.handle('foundry:save-hypothesis', async (event, payload: unknown) => {
    try {
      validateSender(event);
      const validated = SaveHypothesisSchema.parse(payload);
      return await formatFoundryService.saveHypothesisLedger(validated.sessionId, validated.formatId, validated.ledgerJson);
    } catch (error) {
      log.error('[FoundryHandler] foundry:save-hypothesis failed:', error);
      throw error;
    }
  });

  ipcMain.handle('foundry:load-hypothesis', async (event, payload: unknown) => {
    try {
      validateSender(event);
      const validated = LoadHypothesisSchema.parse(payload);
      return await formatFoundryService.loadHypothesisLedger(validated.formatId);
    } catch (error) {
      log.error('[FoundryHandler] foundry:load-hypothesis failed:', error);
      throw error;
    }
  });

  ipcMain.handle('foundry:list-hypotheses', async (event) => {
    try {
      validateSender(event);
      return await formatFoundryService.listHypothesisLedgers();
    } catch (error) {
      log.error('[FoundryHandler] foundry:list-hypotheses failed:', error);
      throw error;
    }
  });

  ipcMain.handle('foundry:book-statement', async (event, payload: unknown) => {
    try {
      validateSender(event);
      const validated = BookStatementSchema.parse(payload);
      return await formatFoundryService.bookStatement(validated.sessionId, validated.statementId, validated.normalizedReportJson);
    } catch (error) {
      log.error('[FoundryHandler] foundry:book-statement failed:', error);
      throw error;
    }
  });
};
