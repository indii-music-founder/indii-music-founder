import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import log from 'electron-log';
import { accessControlService } from '../security/AccessControlService';

// ============================================================================
// Session Grant — mirrors ComputerExecutionService pattern
// ============================================================================

interface FoundrySessionGrant {
  sessionId: string;
  grantedAt: number;
  expiresAt: number;
  ownerUserId: string;
}

const DEFAULT_GRANT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_TEXT_FILE_SIZE = 50 * 1024 * 1024; // 50 MB hard limit for text files
const MAX_HYPOTHESIS_SIZE = 10 * 1024 * 1024; // 10 MB hypothesis ledger limit

// ============================================================================
// FormatFoundryService — headless main-process orchestrator
// ============================================================================

export class FormatFoundryService {
  private grants = new Map<string, FoundrySessionGrant>();

  // --- Storage Paths ---------------------------------------------------------

  private getFoundryDataDir(): string {
    return path.join(app.getPath('userData'), 'foundry');
  }

  private async ensureFoundryDir(): Promise<string> {
    const dir = this.getFoundryDataDir();
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  private getHypothesisDir(): string {
    return path.join(this.getFoundryDataDir(), 'hypotheses');
  }

  private getEvidenceDir(): string {
    return path.join(this.getFoundryDataDir(), 'evidence');
  }

  // --- Session Grants --------------------------------------------------------

  grantSession(sessionId: string, ownerUserId: string, ttlMs = DEFAULT_GRANT_TTL_MS): FoundrySessionGrant {
    const now = Date.now();
    const grant: FoundrySessionGrant = {
      sessionId,
      grantedAt: now,
      expiresAt: now + ttlMs,
      ownerUserId,
    };
    this.grants.set(sessionId, grant);
    log.info(`[FormatFoundryService] Session granted: ${sessionId} for user ${ownerUserId}, TTL ${ttlMs}ms`);
    return grant;
  }

  revokeGrant(sessionId: string): void {
    this.grants.delete(sessionId);
    log.info(`[FormatFoundryService] Session revoked: ${sessionId}`);
  }

  hasActiveGrant(sessionId: string, now = Date.now()): boolean {
    const grant = this.grants.get(sessionId);
    if (!grant) return false;
    if (grant.expiresAt <= now) {
      this.grants.delete(sessionId);
      return false;
    }
    return true;
  }

  private requireGrant(sessionId: string): FoundrySessionGrant {
    if (!this.hasActiveGrant(sessionId)) {
      throw new Error(`Security Error: No active foundry session grant for "${sessionId}". Call grantSession() first.`);
    }
    return this.grants.get(sessionId)!;
  }

  // --- Path Security ---------------------------------------------------------

  private verifyPath(filePath: string): void {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Security Error: File path is required.');
    }
    if (filePath.includes('\0')) {
      throw new Error('Security Error: Null bytes in file path.');
    }
    if (filePath.length > 4096) {
      throw new Error('Security Error: File path exceeds 4096 character limit.');
    }
    const resolved = path.resolve(filePath);
    if (!accessControlService.verifyAccess(resolved)) {
      throw new Error(`Security Error: Access denied for path "${resolved}".`);
    }
  }

  private verifyFoundryInternalPath(filePath: string): void {
    const resolved = path.resolve(filePath);
    const foundryDir = path.resolve(this.getFoundryDataDir());
    if (!resolved.startsWith(foundryDir + path.sep) && resolved !== foundryDir) {
      throw new Error(`Security Error: Path "${resolved}" is outside foundry data directory.`);
    }
  }

  // --- Evidence Intake -------------------------------------------------------

  /**
   * Safely read a text file from disk after verifying access control.
   * Enforces size limits and returns SHA-256 hash for provenance.
   */
  async readTextFile(filePath: string): Promise<{ success: boolean; content?: string; sha256?: string; sizeBytes?: number; error?: string }> {
    try {
      this.verifyPath(filePath);

      const stat = await fs.stat(filePath);
      if (stat.size > MAX_TEXT_FILE_SIZE) {
        return { success: false, error: `File exceeds ${MAX_TEXT_FILE_SIZE / 1024 / 1024}MB size limit (${stat.size} bytes).` };
      }

      const buffer = await fs.readFile(filePath);
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      const content = buffer.toString('utf-8');

      return { success: true, content, sha256, sizeBytes: stat.size };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn(`[FormatFoundryService] readTextFile failed for "${filePath}": ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Get file metadata without reading content.
   */
  async getFileMetadata(filePath: string): Promise<{ success: boolean; size?: number; modifiedAt?: string; error?: string }> {
    try {
      this.verifyPath(filePath);

      const stat = await fs.stat(filePath);
      return { success: true, size: stat.size, modifiedAt: stat.mtime.toISOString() };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  // --- Hypothesis Ledger Persistence -----------------------------------------

  /**
   * Save a hypothesis ledger to the foundry data directory.
   * Requires an active session grant.
   */
  async saveHypothesisLedger(sessionId: string, formatId: string, ledgerJson: string): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      this.requireGrant(sessionId);

      if (!formatId || typeof formatId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(formatId)) {
        return { success: false, error: 'Invalid formatId: must be alphanumeric with hyphens/underscores.' };
      }

      if (Buffer.byteLength(ledgerJson, 'utf-8') > MAX_HYPOTHESIS_SIZE) {
        return { success: false, error: `Hypothesis ledger exceeds ${MAX_HYPOTHESIS_SIZE / 1024 / 1024}MB size limit.` };
      }

      // Validate JSON structure
      try {
        JSON.parse(ledgerJson);
      } catch {
        return { success: false, error: 'Invalid JSON in hypothesis ledger.' };
      }

      const dir = this.getHypothesisDir();
      await fs.mkdir(dir, { recursive: true });

      const filePath = path.join(dir, `${formatId}.json`);
      this.verifyFoundryInternalPath(filePath);

      // Atomic write: temp file then rename
      const tempPath = path.join(dir, `.${formatId}.json.tmp.${Date.now()}`);
      await fs.writeFile(tempPath, ledgerJson, 'utf-8');
      await fs.rename(tempPath, filePath);

      log.info(`[FormatFoundryService] Hypothesis ledger saved: ${filePath} (${Buffer.byteLength(ledgerJson)} bytes)`);
      return { success: true, path: filePath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`[FormatFoundryService] saveHypothesisLedger failed: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Load a hypothesis ledger from the foundry data directory.
   */
  async loadHypothesisLedger(formatId: string): Promise<{ success: boolean; ledger?: unknown; error?: string }> {
    try {
      if (!formatId || !/^[a-zA-Z0-9_-]+$/.test(formatId)) {
        return { success: false, error: 'Invalid formatId.' };
      }

      const filePath = path.join(this.getHypothesisDir(), `${formatId}.json`);
      this.verifyFoundryInternalPath(filePath);

      const content = await fs.readFile(filePath, 'utf-8');
      const ledger = JSON.parse(content);
      return { success: true, ledger };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  /**
   * List all saved hypothesis ledgers.
   */
  async listHypothesisLedgers(): Promise<{ success: boolean; formats?: string[]; error?: string }> {
    try {
      const dir = this.getHypothesisDir();
      try {
        const files = await fs.readdir(dir);
        const formats = files
          .filter(f => f.endsWith('.json') && !f.startsWith('.'))
          .map(f => f.replace('.json', ''));
        return { success: true, formats };
      } catch {
        // Directory doesn't exist yet
        return { success: true, formats: [] };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  // --- Bookkeeping Gate (Consequential Action) --------------------------------

  /**
   * Books a statement into the financial ledger.
   * FAILS CLOSED: requires an active session grant.
   * This is a consequential action that modifies financial state.
   */
  async bookStatement(
    sessionId: string,
    statementId: string,
    normalizedReportJson: string
  ): Promise<{ success: boolean; bookedAt?: string; receiptHash?: string; error?: string }> {
    try {
      const grant = this.requireGrant(sessionId);

      if (!statementId || typeof statementId !== 'string') {
        return { success: false, error: 'statementId is required.' };
      }

      // Validate the normalized report is valid JSON
      let report: Record<string, unknown>;
      try {
        report = JSON.parse(normalizedReportJson);
      } catch {
        return { success: false, error: 'Invalid JSON in normalizedReportJson.' };
      }

      if (!report.reportId || !report.formatId) {
        return { success: false, error: 'Normalized report must include reportId and formatId.' };
      }

      // Create booking receipt
      const bookedAt = new Date().toISOString();
      const receiptPayload = JSON.stringify({
        statementId,
        reportId: report.reportId,
        formatId: report.formatId,
        ownerUserId: grant.ownerUserId,
        sessionId: grant.sessionId,
        bookedAt,
      });
      const receiptHash = crypto.createHash('sha256').update(receiptPayload).digest('hex');

      // Persist booking receipt
      const bookingsDir = path.join(this.getFoundryDataDir(), 'bookings');
      await fs.mkdir(bookingsDir, { recursive: true });

      const receiptPath = path.join(bookingsDir, `${statementId}.json`);
      this.verifyFoundryInternalPath(receiptPath);

      const tempPath = path.join(bookingsDir, `.${statementId}.json.tmp.${Date.now()}`);
      await fs.writeFile(tempPath, receiptPayload, 'utf-8');
      await fs.rename(tempPath, receiptPath);

      log.info(`[FormatFoundryService] Statement booked: ${statementId} by user ${grant.ownerUserId} (receipt: ${receiptHash.slice(0, 12)}…)`);

      return { success: true, bookedAt, receiptHash };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`[FormatFoundryService] bookStatement failed: ${message}`);
      return { success: false, error: message };
    }
  }

  // --- Diagnostic ------------------------------------------------------------

  /**
   * Returns service health info for diagnostics.
   */
  getStatus(): { activeGrants: number; foundryDataDir: string } {
    // Prune expired grants
    const now = Date.now();
    for (const [id, grant] of this.grants.entries()) {
      if (grant.expiresAt <= now) {
        this.grants.delete(id);
      }
    }

    return {
      activeGrants: this.grants.size,
      foundryDataDir: this.getFoundryDataDir(),
    };
  }
}

export const formatFoundryService = new FormatFoundryService();
