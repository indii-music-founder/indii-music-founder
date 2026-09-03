import fs from 'fs/promises';
import crypto from 'crypto';
import { accessControlService } from '../security/AccessControlService';

export class FormatFoundryService {
  /**
   * Safely read text file from disk after verifying access control
   */
  async readTextFile(filePath: string): Promise<{ success: boolean; content?: string; sha256?: string; error?: string }> {
    try {
      if (!accessControlService.verifyAccess(filePath)) {
        return { success: false, error: 'Access denied: Path is outside allowed directories.' };
      }

      const buffer = await fs.readFile(filePath);
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const content = buffer.toString('utf-8');

      return { success: true, content, sha256 };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Check if file exists and get metadata
   */
  async getFileMetadata(filePath: string): Promise<{ success: boolean; size?: number; error?: string }> {
    try {
      if (!accessControlService.verifyAccess(filePath)) {
        return { success: false, error: 'Access denied: Path is outside allowed directories.' };
      }

      const stat = await fs.stat(filePath);
      return { success: true, size: stat.size };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const formatFoundryService = new FormatFoundryService();
