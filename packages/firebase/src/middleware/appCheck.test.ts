import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import * as admin from 'firebase-admin';

// Mock firebase-admin App Check verifyToken
vi.mock('firebase-admin', () => {
  const verifyTokenMock = vi.fn();
  return {
    appCheck: () => ({
      verifyToken: verifyTokenMock,
    }),
  };
});

describe('App Check Middleware', () => {
  let appCheckModule: any;
  let originalVitest: string | undefined;

  beforeAll(async () => {
    originalVitest = process.env.VITEST;
    // Temporarily delete process.env.VITEST so ENFORCE_APP_CHECK resolves to true in appCheck.ts
    delete process.env.VITEST;
    appCheckModule = await import('./appCheck');
  });

  afterAll(() => {
    process.env.VITEST = originalVitest;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The validateAppCheckV1 block was removed with the function itself
  // (ISSUE-1243). Its three cases — forged Electron client-type header, forged
  // Electron user agent, and missing token — are covered identically by the
  // validateAppCheckV2 block below, which guards the same ISSUE-1223 boundary.

  describe('requireVerifiedEmailV2', () => {
    it('rejects unauthenticated and unverified callers before a spend-bearing callable can run', () => {
      expect(() => appCheckModule.requireVerifiedEmailV2({})).toThrow('User must be authenticated.');
      expect(() => appCheckModule.requireVerifiedEmailV2({
        auth: { uid: 'user-1', token: { email_verified: false } },
      })).toThrow('Verify your email before using creative generation.');
    });

    it('returns only the signed-in UID when the Firebase verification claim is true', () => {
      expect(appCheckModule.requireVerifiedEmailV2({
        auth: { uid: 'verified-user', token: { email_verified: true } },
      })).toBe('verified-user');
    });
  });

  describe('validateAppCheckV2', () => {
    it('rejects a forgeable Electron client-type header when App Check is missing', () => {
      const mockRequest = {
        rawRequest: {
          headers: {
            'x-app-client-type': 'electron-desktop-app',
          },
        },
      } as any;

      expect(() => appCheckModule.validateAppCheckV2(mockRequest)).toThrow('Unauthorized: Missing App Check token.');
    });

    it('rejects a forgeable Electron user agent when App Check is missing', () => {
      const mockRequest = {
        rawRequest: {
          headers: {
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Electron/28.0.0',
          },
        },
      } as any;

      expect(() => appCheckModule.validateAppCheckV2(mockRequest)).toThrow('Unauthorized: Missing App Check token.');
    });

    it('should throw error if App Check is enforced and token is missing', () => {
      const mockRequest = {
        rawRequest: {
          headers: {},
        },
      } as any;

      expect(() => appCheckModule.validateAppCheckV2(mockRequest)).toThrow('Unauthorized: Missing App Check token.');
    });
  });

  describe('validateAppCheckHttp', () => {
    it('rejects a forgeable Electron client-type header when App Check is missing', async () => {
      const mockReq = {
        headers: {
          'x-app-client-type': 'electron-desktop-app',
        },
      } as any;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as any;

      const result = await appCheckModule.validateAppCheckHttp(mockReq, mockRes);
      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should send 401 if App Check token is missing', async () => {
      const mockReq = {
        headers: {},
        header: vi.fn().mockReturnValue(undefined),
      } as any;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as any;

      const result = await appCheckModule.validateAppCheckHttp(mockReq, mockRes);
      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith('Unauthorized: Missing App Check token');
    });

    it('should pass if App Check token is valid', async () => {
      const verifyTokenMock = vi.mocked(admin.appCheck().verifyToken);
      verifyTokenMock.mockResolvedValue({} as any);

      const mockReq = {
        headers: {},
        header: vi.fn().mockReturnValue('valid-token'),
      } as any;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as any;

      const result = await appCheckModule.validateAppCheckHttp(mockReq, mockRes);
      expect(result).toBe(true);
      expect(verifyTokenMock).toHaveBeenCalledWith('valid-token');
    });

    it('should send 401 if App Check token is invalid', async () => {
      const verifyTokenMock = vi.mocked(admin.appCheck().verifyToken);
      verifyTokenMock.mockRejectedValue(new Error('Invalid token'));

      const mockReq = {
        headers: {},
        header: vi.fn().mockReturnValue('invalid-token'),
      } as any;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as any;

      const result = await appCheckModule.validateAppCheckHttp(mockReq, mockRes);
      expect(result).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith('Unauthorized: Invalid App Check token');
    });
  });
});
