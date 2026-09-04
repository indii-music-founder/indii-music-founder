import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import os from 'os';
import { formatFoundryService } from '../services/FormatFoundryService';
import { accessControlService } from '../security/AccessControlService';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockImplementation((name: string) => {
      if (name === 'userData') {
        return path.join(os.tmpdir(), 'indii-foundry-test');
      }
      return os.tmpdir();
    }),
  },
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../security/AccessControlService', () => ({
  accessControlService: {
    verifyAccess: vi.fn(),
    grantAccess: vi.fn(),
  },
}));

describe('FormatFoundryService Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Path Security ---

  it('denies file read when path is unauthorized', async () => {
    vi.mocked(accessControlService.verifyAccess).mockReturnValue(false);

    const result = await formatFoundryService.readTextFile('/etc/passwd');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('denies metadata check when path is unauthorized', async () => {
    vi.mocked(accessControlService.verifyAccess).mockReturnValue(false);

    const result = await formatFoundryService.getFileMetadata('/private/var/keys');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('rejects path traversal in readTextFile', async () => {
    vi.mocked(accessControlService.verifyAccess).mockReturnValue(false);

    const result = await formatFoundryService.readTextFile('../../../etc/passwd');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Access denied');
  });

  it('rejects null byte injection in file paths', async () => {
    vi.mocked(accessControlService.verifyAccess).mockReturnValue(true);

    const result = await formatFoundryService.readTextFile('/photos/good.tsv\0/evil.sh');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Null bytes in file path');
  });

  it('rejects file path exceeding 4096 character limit', async () => {
    vi.mocked(accessControlService.verifyAccess).mockReturnValue(true);

    const longPath = '/photos/' + 'a'.repeat(4100) + '.tsv';
    const result = await formatFoundryService.readTextFile(longPath);
    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds 4096 character limit');
  });

  // --- Session Grants & Consequential Actions ---

  it('fails closed: saveHypothesisLedger rejects when no session grant exists', async () => {
    const result = await formatFoundryService.saveHypothesisLedger(
      'unauthorized-session-id',
      'distrokid_tsv',
      JSON.stringify({ formatId: 'distrokid_tsv', hypotheses: [] })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active foundry session grant');
  });

  it('allows saveHypothesisLedger when active grant exists and revokes properly', async () => {
    const sessionId = `test-sess-${Date.now()}`;
    formatFoundryService.grantSession(sessionId, 'artist-user-123', 60_000);

    expect(formatFoundryService.hasActiveGrant(sessionId)).toBe(true);

    const result = await formatFoundryService.saveHypothesisLedger(
      sessionId,
      'distrokid_tsv',
      JSON.stringify({ formatId: 'distrokid_tsv', hypotheses: [] })
    );

    expect(result.success).toBe(true);
    expect(result.path).toBeDefined();

    // Revocation
    formatFoundryService.revokeGrant(sessionId);
    expect(formatFoundryService.hasActiveGrant(sessionId)).toBe(false);

    // After revocation, should fail
    const revokedResult = await formatFoundryService.saveHypothesisLedger(
      sessionId,
      'distrokid_tsv',
      JSON.stringify({ formatId: 'distrokid_tsv', hypotheses: [] })
    );
    expect(revokedResult.success).toBe(false);
    expect(revokedResult.error).toContain('No active foundry session grant');
  });

  it('rejects malicious formatId with path traversal characters', async () => {
    const sessionId = `test-sess-${Date.now()}`;
    formatFoundryService.grantSession(sessionId, 'artist-user-123', 60_000);

    const result = await formatFoundryService.saveHypothesisLedger(
      sessionId,
      '../../etc/cron',
      JSON.stringify({ formatId: 'cron', hypotheses: [] })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid formatId');
  });

  it('fails closed: bookStatement rejects when no session grant exists', async () => {
    const result = await formatFoundryService.bookStatement(
      'missing-grant-id',
      'STMT-2026-001',
      JSON.stringify({ reportId: 'RPT-001', formatId: 'distrokid_tsv' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active foundry session grant');
  });

  it('succeeds: bookStatement creates persistent receipt with hash when grant exists', async () => {
    const sessionId = `test-book-${Date.now()}`;
    formatFoundryService.grantSession(sessionId, 'artist-user-456', 60_000);

    const result = await formatFoundryService.bookStatement(
      sessionId,
      'STMT-2026-002',
      JSON.stringify({ reportId: 'RPT-002', formatId: 'tunecore_csv' })
    );

    expect(result.success).toBe(true);
    expect(result.receiptHash).toBeDefined();
    expect(result.bookedAt).toBeDefined();
    expect(result.receiptHash?.length).toBe(64); // SHA-256 hex
  });

  it('rejects bookStatement with malformed JSON report', async () => {
    const sessionId = `test-book-malformed-${Date.now()}`;
    formatFoundryService.grantSession(sessionId, 'artist-user-789', 60_000);

    const result = await formatFoundryService.bookStatement(
      sessionId,
      'STMT-2026-003',
      'NOT_VALID_JSON'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid JSON');
  });
});
