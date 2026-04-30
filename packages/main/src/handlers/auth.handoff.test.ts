import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.fn();
const focusMock = vi.fn();
const restoreMock = vi.fn();

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [{
      isDestroyed: () => false,
      isMinimized: () => false,
      restore: restoreMock,
      focus: focusMock,
      webContents: { isDestroyed: () => false, send: sendMock }
    }]
  },
  ipcMain: { handle: vi.fn() },
  shell: { openExternal: vi.fn() },
  session: { defaultSession: { clearStorageData: vi.fn() } }
}));

vi.mock('../services/AuthStorage', () => ({
  authStorage: { saveToken: vi.fn(), deleteToken: vi.fn() }
}));

import { handleDeepLink } from './auth';

describe('auth handoff deep link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_HANDOFF_REDEEM_URL = 'https://example.com/redeem';
  });

  it('prevents replay of the same handoff code', async () => {
    const payload = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', exp: Math.floor(Date.now()/1000)+300 }), 'utf8').toString('base64url');
    const idToken = `header.${payload}.sig`;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ idToken, accessToken: 'access-token-12345678901234567890' })
    });
    vi.stubGlobal('fetch', fetchMock as any);

    await handleDeepLink('indii-os://auth/callback?code=one-time-1234');
    await handleDeepLink('indii-os://auth/callback?code=one-time-1234');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith('auth:error', expect.objectContaining({ message: expect.stringContaining('already redeemed') }));
  });

  it('rejects expired or invalid handoff code from backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 410,
      json: async () => ({})
    });
    vi.stubGlobal('fetch', fetchMock as any);

    await handleDeepLink('indii-os://auth/callback?code=expired-9999');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith('auth:error', expect.objectContaining({ message: expect.stringContaining('expired or invalid') }));
  });
});
