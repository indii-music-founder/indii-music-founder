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

  describe('validateAppCheckV1', () => {
    it('should bypass App Check if request header indicates electron-desktop-app', () => {
      const mockContext = {
        rawRequest: {
          headers: {
            'x-app-client-type': 'electron-desktop-app',
          },
        },
      } as any;

      expect(() => appCheckModule.validateAppCheckV1(mockContext)).not.toThrow();
    });

    it('should bypass App Check if user agent indicates Electron', () => {
      const mockContext = {
        rawRequest: {
          headers: {
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Electron/28.0.0',
          },
        },
      } as any;

      expect(() => appCheckModule.validateAppCheckV1(mockContext)).not.toThrow();
    });

    it('should throw error if App Check is enforced and token is missing', () => {
      const mockContext = {
        rawRequest: {
          headers: {},
        },
      } as any;

      expect(() => appCheckModule.validateAppCheckV1(mockContext)).toThrow('Unauthorized: Missing App Check token.');
    });
  });

  describe('validateAppCheckV2', () => {
    it('should bypass App Check if request header indicates electron-desktop-app', () => {
      const mockRequest = {
        rawRequest: {
          headers: {
            'x-app-client-type': 'electron-desktop-app',
          },
        },
      } as any;

      expect(() => appCheckModule.validateAppCheckV2(mockRequest)).not.toThrow();
    });

    it('should bypass App Check if user agent indicates Electron', () => {
      const mockRequest = {
        rawRequest: {
          headers: {
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Electron/28.0.0',
          },
        },
      } as any;

      expect(() => appCheckModule.validateAppCheckV2(mockRequest)).not.toThrow();
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
    it('should bypass App Check if request header indicates electron-desktop-app', async () => {
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
      expect(result).toBe(true);
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
