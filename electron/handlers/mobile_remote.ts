/**
 * Mobile Remote IPC Handler — Electron Main Process
 *
 * Spins up a local WebSocket server that the Mobile Remote UI connects to
 * for real-time Zustand state synchronization. This avoids any third-party
 * messaging relay — the connection is purely local-network (Wi-Fi) or
 * Tailscale-tunneled.
 *
 * IPC Channels exposed to renderer:
 *   system:getMobileRemoteInfo → { localIp, port }
 *   mobile-remote:broadcast    → Forwards state payload to all WS clients
 *   mobile-remote:stop         → Stops the WS server
 *
 * Security:
 *   - Connections without a valid passcode are immediately closed.
 *   - Passcode is generated per-session (random 6-digit PIN) and never
 *     persisted to disk in plain text.
 *   - The passcode is only exposed in the QR code (scanned locally) and
 *     cleared on server stop.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { createServer } from 'http';
import { networkInterfaces } from 'os';
import log from 'electron-log';

// Dynamic import of ws to avoid bundler issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- WebSocketServer is dynamically imported; its constructor type varies
let WebSocketServer: any;

interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  once(event: string, listener: (data: Buffer) => void): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  readyState: number;
}

interface MobileClient {
  ws: WebSocketLike;
  authenticated: boolean;
}

let mobileWsServer: ReturnType<typeof createServer> | null = null;
const activeClients: Set<MobileClient> = new Set();
let currentPasscode: string | null = null;
let currentPort = 0;

// ─── Local IP Discovery ───────────────────────────────────────────────────────

function getLocalIpAddress(): string {
  const nets = networkInterfaces();
  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

// ─── Passcode ─────────────────────────────────────────────────────────────────

function generatePasscode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Server Lifecycle ─────────────────────────────────────────────────────────

async function startMobileRemoteServer(): Promise<{ localIp: string; port: number; passcode: string }> {
  if (mobileWsServer) {
    // Already running
    return {
      localIp: getLocalIpAddress(),
      port: currentPort,
      passcode: currentPasscode ?? '',
    };
  }

  // Lazy import ws
  if (!WebSocketServer) {
    const ws = await import('ws');
    WebSocketServer = ws.WebSocketServer ?? ws.default?.Server ?? ws.Server;
  }

  currentPasscode = generatePasscode();

  return new Promise((resolve, reject) => {
    const httpServer = createServer();
    const wss = new WebSocketServer({ server: httpServer });

    wss.on('connection', (ws: WebSocketLike, req: { socket: { remoteAddress?: string } }) => {
      const client: MobileClient = { ws, authenticated: false };
      activeClients.add(client);

      log.info(`[MobileRemote] New WS connection from ${req.socket.remoteAddress}`);

      // Auth timeout: close unauthenticated sockets after 5 seconds
      const authTimeout = setTimeout(() => {
        if (!client.authenticated) {
          log.warn('[MobileRemote] Client auth timed out, closing connection');
          try { ws.close(4002, 'Auth timeout'); } catch { /* ignore */ }
          activeClients.delete(client);
        }
      }, 5000);

      // First message must be the passcode
      ws.once('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'auth' && msg.passcode === currentPasscode) {
            client.authenticated = true;
            clearTimeout(authTimeout);
            ws.send(JSON.stringify({ type: 'auth_ok' }));
            log.info('[MobileRemote] Client authenticated');

            // Register persistent listener for commands from authenticated clients
            ws.on('message', (commandData: unknown) => {
              try {
                const cmd = JSON.parse(String(commandData));
                if (cmd.type !== 'auth') {
                  // Forward to main renderer window for processing
                  const allWindows = BrowserWindow.getAllWindows();
                  if (allWindows.length > 0) {
                    allWindows[0].webContents.send('mobile-remote:command', cmd);
                  }
                }
              } catch {
                log.warn('[MobileRemote] Unparseable command from client');
              }
            });
          } else {
            clearTimeout(authTimeout);
            ws.close(4001, 'Invalid passcode');
            activeClients.delete(client);
            log.warn('[MobileRemote] Client rejected: invalid passcode');
          }
        } catch {
          clearTimeout(authTimeout);
          ws.close(4000, 'Bad auth message');
          activeClients.delete(client);
        }
      });

      ws.on('close', () => {
        clearTimeout(authTimeout);
        activeClients.delete(client);
        log.info('[MobileRemote] Client disconnected');
      });

      ws.on('error', (err: unknown) => {
        clearTimeout(authTimeout);
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error('[MobileRemote] WS client error', errMsg);
        activeClients.delete(client);
      });
    });

    httpServer.on('error', reject);

    // Bind to a random available port
    httpServer.listen(0, '0.0.0.0', () => {
      const addr = httpServer.address() as { port: number };
      currentPort = addr.port;
      mobileWsServer = httpServer;
      log.info(`[MobileRemote] WS server listening on port ${currentPort}`);
      resolve({
        localIp: getLocalIpAddress(),
        port: currentPort,
        passcode: currentPasscode!,
      });
    });
  });
}

function stopMobileRemoteServer(): void {
  if (!mobileWsServer) return;

  for (const client of activeClients) {
    try { client.ws.close(); } catch { /* ignore */ }
  }
  activeClients.clear();
  currentPasscode = null;

  const server = mobileWsServer;
  mobileWsServer = null; // Prevent re-entry

  server.close(() => {
    log.info('[MobileRemote] WS server stopped');
    currentPort = 0;
  });
}

// ─── Broadcast ────────────────────────────────────────────────────────────────

function broadcastToMobileClients(payload: unknown): void {
  const message = JSON.stringify({ type: 'sync', payload, ts: Date.now() });
  for (const client of activeClients) {
    if (client.authenticated && client.ws.readyState === 1 /* OPEN */) {
      try {
        client.ws.send(message);
      } catch (err) {
        log.error('[MobileRemote] Broadcast error', err);
      }
    }
  }
}

// ─── IPC Registration ─────────────────────────────────────────────────────────

export function registerMobileRemoteHandlers(): void {
  /**
   * Renderer requests pairing info (starts server if not running).
   * Returns { localIp, port, passcode } — passcode is shown in QR code only.
   */
  ipcMain.handle('system:getMobileRemoteInfo', async () => {
    try {
      const info = await startMobileRemoteServer();
      return { success: true, ...info };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log.error('[MobileRemote] Failed to start WS server', err);
      return { success: false, error: message };
    }
  });

  /**
   * Renderer sends a Zustand state slice to broadcast to all mobile clients.
   */
  ipcMain.on('mobile-remote:broadcast', (_event, payload: unknown) => {
    broadcastToMobileClients(payload);
  });

  /**
   * Renderer requests server shutdown.
   */
  ipcMain.handle('mobile-remote:stop', () => {
    stopMobileRemoteServer();
    return { success: true };
  });

  /**
   * Forward inbound mobile commands to the main renderer window.
   */
  // (Mobile → Desktop relay happens inside the WS message handler above
  //  by calling mainWindow.webContents.send('mobile-remote:command', cmd))

  log.info('[MobileRemote] IPC handlers registered');
}

export { broadcastToMobileClients, stopMobileRemoteServer };
