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
    delete process.env.VITE_LANDING_PAGE_URL;
  });

  it('is explicitly disconnected from external bridge', async () => {
    const { registerAuthHandlers } = await import('./auth');
    registerAuthHandlers();

    const loginHandler = handleMock.mock.calls.find(([channel]) => channel === 'auth:login-google')?.[1];
    expect(loginHandler).toBeDefined();

    const result = await loginHandler();

    expect(result).toEqual({ ok: false, reason: 'external-login-bridge-disabled' });
    expect(openExternalMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });
});
