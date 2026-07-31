import { validateSender } from '../utils/ipc-security';
/**
 * Mobile Remote IPC Handler — Electron Main Process
 *
 * This is the IPC handler that connects the React desktop application to the
 * native Node.js Express/Ngrok server running inside the Electron main process
 * (the IndiiRemoteService).
 *
 * It overrides the legacy local-wi-fi-only WS server.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ISSUE-1284 — UNREACHABLE FROM THE RENDERER. DO NOT ASSUME THIS IS LIVE.
 *
 * `system:getMobileRemoteInfo` and `mobile-remote:stop` are registered here, and
 * `packages/renderer/src/types/electron.d.ts` even declares an optional
 * `getMobileRemoteInfo` on `window.electronAPI` — but `handlers/preload.ts` never
 * exposes either channel, and no renderer code calls them. Both ends silently
 * agree never to use a fully-built main-process feature.
 *
 * Verified 2026-07-29: device pairing actually ships through the newer
 * Firestore handoff-code flow in
 * `packages/renderer/src/modules/settings/settings-panel/RemoteSection.tsx`
 * (redeemHandoffCode → signInWithCustomToken), so this IPC path appears
 * SUPERSEDED rather than merely unfinished.
 *
 * Left in place, not deleted, per the Asset Deletion Fail-Safe (CLAUDE.md §7):
 * removal needs a human confirmation that nothing out-of-tree depends on it.
 * If you are here to "fix" the pairing flow: wiring these channels up would
 * build a SECOND parallel implementation of something that already works.
 * Confirm intent first.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import crypto from 'crypto';
import { indiiRemoteService } from '../services/IndiiRemoteService';
import { isLegacyEdgeRemoteEnabled } from '../services/RemoteTransportPolicy';

// Generate a cryptographically random numeric passcode
function generatePasscode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function registerMobileRemoteHandlers(): void {


  /**
   * Renderer sends a Zustand state slice to broadcast to all mobile clients.
   */
  ipcMain.on('mobile-remote:broadcast', (_event, payload: unknown) => {
      validateSender(_event);
    if (!isLegacyEdgeRemoteEnabled()) return;
    // We wrap it in a format the mobile WS client expects
    indiiRemoteService.sendToMobile({ type: 'sync', payload, ts: Date.now() });
  });



  /**
   * Returns current IndiiRemoteService status and pairing info.
   */
  ipcMain.handle('system:getMobileRemoteInfo', async (event) => {
    validateSender(event);
    return indiiRemoteService.getStatus();
  });

  /**
   * Stops the running IndiiRemoteService server.
   */
  ipcMain.handle('mobile-remote:stop', async (event) => {
    validateSender(event);
    await indiiRemoteService.stop();
    return { success: true };
  });

  log.info('[MobileRemote] IPC handlers registered for IndiiRemoteService (Ngrok)');
}

export const stopMobileRemoteServer = async () => await indiiRemoteService.stop();
export const broadcastToMobileClients = (payload: unknown) => {
  if (!isLegacyEdgeRemoteEnabled()) return;
  indiiRemoteService.sendToMobile({ type: 'sync', payload, ts: Date.now() });
};
