import { beforeEach, describe, expect, it, vi } from 'vitest';

const handleMock = vi.fn();
const openExternalMock = vi.fn();
const sendMock = vi.fn();
const getAllWindowsMock = vi.fn(() => [
  {
    isDestroyed: () => false,
    webContents: {
      isDestroyed: () => false,
      send: sendMock,
    },
  },
]);

vi.mock('electron', () => ({
  ipcMain: { handle: handleMock },
  shell: { openExternal: openExternalMock },
  BrowserWindow: { getAllWindows: getAllWindowsMock },
  session: {
    defaultSession: {
      clearStorageData: vi.fn(),
    },
  },
}));

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../services/AuthStorage', () => ({
  authStorage: {
    deleteToken: vi.fn(),
    saveToken: vi.fn(),
  },
}));

describe('auth:login-google handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.INDIIOS_ENABLE_LOGIN_BRIDGE;
    delete process.env.LOGIN_BRIDGE_URL;
  });

  it('uses native desktop path by default', async () => {
    const { registerAuthHandlers } = await import('./auth');
    registerAuthHandlers();

    const loginHandler = handleMock.mock.calls.find(([channel]) => channel === 'auth:login-google')?.[1];
    expect(loginHandler).toBeDefined();

    const result = await loginHandler();

    expect(result).toEqual({ mode: 'native' });
    expect(sendMock).toHaveBeenCalledWith('auth:begin-native-google');
    expect(openExternalMock).not.toHaveBeenCalled();
  });

  it('uses web bridge fallback when enabled', async () => {
    process.env.INDIIOS_ENABLE_LOGIN_BRIDGE = 'true';
    process.env.LOGIN_BRIDGE_URL = 'https://example.com/login-bridge';

    const { registerAuthHandlers } = await import('./auth');
    registerAuthHandlers();

    const loginHandler = handleMock.mock.calls.find(([channel]) => channel === 'auth:login-google')?.[1];
    const result = await loginHandler();

    expect(result).toEqual({ mode: 'bridge' });
    expect(openExternalMock).toHaveBeenCalledWith('https://example.com/login-bridge');
    expect(sendMock).toHaveBeenCalledWith('auth:bridge-warning', expect.any(Object));
  });

  it('returns error when fallback enabled but bridge env var missing', async () => {
    process.env.INDIIOS_ENABLE_LOGIN_BRIDGE = 'true';

    const { registerAuthHandlers } = await import('./auth');
    registerAuthHandlers();

    const loginHandler = handleMock.mock.calls.find(([channel]) => channel === 'auth:login-google')?.[1];
    const result = await loginHandler();

    expect(result).toEqual({
      mode: 'error',
      message: 'Web login bridge fallback is enabled but LOGIN_BRIDGE_URL is missing.',
    });
    expect(openExternalMock).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledWith('auth:error', {
      message: 'Web login bridge fallback is enabled but LOGIN_BRIDGE_URL is missing.',
    });
  });
});
