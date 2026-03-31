/**
 * Mobile Remote IPC Handler — Electron Main Process
 *
 * This is the IPC handler that connects the React desktop application to the
 * native Node.js Express/Ngrok server running inside the Electron main process
 * (the IndiiRemoteService).
 *
 * It overrides the legacy local-wi-fi-only WS server.
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import { indiiRemoteService } from '../services/IndiiRemoteService';

// Fallback logic to generate random numeric passcode if none exists
function generatePasscode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const sessionPasscode = generatePasscode();

export function registerMobileRemoteHandlers(): void {
  /**
   * Renderer requests pairing info (starts server if not running).
   * It also fetches the active Ngrok Auth Token from the user's environment.
   */
  ipcMain.handle('system:getMobileRemoteInfo', async () => {
    try {
      // In production, we'd grab this from Keytar or user desktop settings.
      // For now, we try to load the Ngrok token from env vars.
      const token = process.env.VITE_NGROK_AUTHTOKEN || process.env.NGROK_AUTHTOKEN;

      const config = {
        port: 3333,
        ngrokToken: token,
        password: sessionPasscode,
      };

      const url = await indiiRemoteService.start(config);

      return {
        success: true,
        // We override localIp to return the Ngrok URL so the QR code generates correctly
        localIp: url,
        port: 3333,
        passcode: sessionPasscode
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log.error('[MobileRemote] Failed to start WS/Ngrok server', err);
      return { success: false, error: message };
    }
  });

  /**
   * Renderer sends a Zustand state slice to broadcast to all mobile clients.
   */
  ipcMain.on('mobile-remote:broadcast', (_event, payload: unknown) => {
    // We wrap it in a format the mobile WS client expects
    indiiRemoteService.sendToMobile({ type: 'sync', payload, ts: Date.now() });
  });

  /**
   * Renderer requests server shutdown.
   */
  ipcMain.handle('mobile-remote:stop', async () => {
    await indiiRemoteService.stop();
    return { success: true };
  });

  log.info('[MobileRemote] IPC handlers registered for IndiiRemoteService (Ngrok)');
}

export const stopMobileRemoteServer = async () => await indiiRemoteService.stop();
export const broadcastToMobileClients = (payload: unknown) => indiiRemoteService.sendToMobile({ type: 'sync', payload, ts: Date.now() });
