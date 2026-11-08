import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerFoundryHandlers } from './foundry';

const mocks = vi.hoisted(() => ({
  ipcMain: { handle: vi.fn() },
  authStorage: {
    getAuthenticatedUserId: vi.fn(),
  },
  formatFoundryService: {
    grantSession: vi.fn().mockReturnValue({ success: true, expiresAt: Date.now() + 60_000 }),
    revokeGrant: vi.fn(),
    readTextFile: vi.fn().mockResolvedValue({ success: true }),
    getFileMetadata: vi.fn().mockResolvedValue({ success: true }),
    saveHypothesisLedger: vi.fn().mockResolvedValue({ success: true }),
    loadHypothesisLedger: vi.fn().mockResolvedValue({ success: true }),
    listHypothesisLedgers: vi.fn().mockResolvedValue({ success: true, formatIds: [] }),
    bookStatement: vi.fn().mockResolvedValue({ success: true, bookedAt: '2026-11-08T00:00:00Z', receiptHash: 'hash' }),
  },
}));

vi.mock('electron', () => ({
  ipcMain: mocks.ipcMain,
  app: { isPackaged: false, getAppPath: () => '/app', getPath: () => '/tmp' },
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../services/AuthStorage', () => ({
  authStorage: mocks.authStorage,
}));

vi.mock('../services/FormatFoundryService', () => ({
  formatFoundryService: mocks.formatFoundryService,
}));

describe('Format Foundry IPC Handlers Security & Verification (ISSUE-1572)', () => {
  let handlers: Record<string, (...args: unknown[]) => Promise<unknown>>;
  const validEvent = {
    sender: { id: 1 },
    senderFrame: { url: 'file:///app/index.html' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};
    mocks.ipcMain.handle.mockImplementation((name: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers[name] = handler;
    });
    registerFoundryHandlers();
  });

  describe('foundry:grant-session', () => {
    it('binds session to authenticated userId from authStorage', async () => {
      mocks.authStorage.getAuthenticatedUserId.mockResolvedValue('auth-user-999');

      const result = await handlers['foundry:grant-session'](validEvent, {
        sessionId: 'sess-123',
        ttlMs: 60_000,
      });

      expect(mocks.authStorage.getAuthenticatedUserId).toHaveBeenCalled();
      expect(mocks.formatFoundryService.grantSession).toHaveBeenCalledWith('sess-123', 'auth-user-999', 60_000);
      expect(result).toEqual({ success: true, expiresAt: expect.any(Number) });
    });

    it('rejects unauthenticated caller when neither authStorage nor ownerUserId exists', async () => {
      mocks.authStorage.getAuthenticatedUserId.mockResolvedValue(null);

      await expect(
        handlers['foundry:grant-session'](validEvent, { sessionId: 'sess-anon' })
      ).rejects.toThrow('Authentication required to grant a Format Foundry session');
    });

    it('rejects mismatched ownerUserId when authStorage has a different active user', async () => {
      mocks.authStorage.getAuthenticatedUserId.mockResolvedValue('legit-user-1');

      await expect(
        handlers['foundry:grant-session'](validEvent, {
          sessionId: 'sess-spoof',
          ownerUserId: 'victim-user-2',
        })
      ).rejects.toThrow('Unauthorized: ownerUserId does not match active authenticated session');
    });
  });

  describe('foundry:book-statement', () => {
    it('rejects path traversal in statementId', async () => {
      await expect(
        handlers['foundry:book-statement'](validEvent, {
          sessionId: 'sess-valid',
          statementId: '../../etc/passwd',
          normalizedReportJson: JSON.stringify({ formatId: 'test' }),
        })
      ).rejects.toThrow();

      expect(mocks.formatFoundryService.bookStatement).not.toHaveBeenCalled();
    });

    it('rejects invalid statementId with spaces or special characters', async () => {
      await expect(
        handlers['foundry:book-statement'](validEvent, {
          sessionId: 'sess-valid',
          statementId: 'statement 2026/01;rm -rf',
          normalizedReportJson: JSON.stringify({ formatId: 'test' }),
        })
      ).rejects.toThrow();

      expect(mocks.formatFoundryService.bookStatement).not.toHaveBeenCalled();
    });

    it('accepts sanitized statementId and delegates to formatFoundryService.bookStatement', async () => {
      const validPayload = {
        sessionId: 'sess-valid',
        statementId: 'stmt_distrokid_2026_03',
        normalizedReportJson: JSON.stringify({ formatId: 'distrokid_tsv' }),
      };

      const result = await handlers['foundry:book-statement'](validEvent, validPayload);

      expect(mocks.formatFoundryService.bookStatement).toHaveBeenCalledWith(
        'sess-valid',
        'stmt_distrokid_2026_03',
        validPayload.normalizedReportJson
      );
      expect(result).toEqual({ success: true, bookedAt: '2026-11-08T00:00:00Z', receiptHash: 'hash' });
    });
  });
});
