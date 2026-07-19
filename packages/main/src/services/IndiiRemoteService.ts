import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import ngrok from '@ngrok/ngrok';
import { app as electronApp, BrowserWindow } from 'electron';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

export interface RemoteConfig {
    port?: number;
    ngrokToken?: string;
    password: string;
}

export class IndiiRemoteError extends Error {
    constructor(public code: string, message: string, public originalError?: unknown) {
        super(message);
        this.name = 'IndiiRemoteError';
    }
}

class IndiiRemoteService {
    private server: ReturnType<typeof createServer> | null = null;
    private wss: WebSocketServer | null = null;
    private expressApp: ReturnType<typeof express> | null = null;
    private url: string | null = null;
    private isRunning = false;
    private pendingStart: Promise<string> | null = null;
    private clients: Set<WebSocket> = new Set();
    private authenticatedClients: WeakSet<WebSocket> = new WeakSet();
    private authAttempts = new Map<string, { count: number, resetAt: number }>();

    // Config defaults
    private port = 3333;
    private password = '';

    constructor() {
        console.log('[IndiiRemoteService] Service instantiated.');
    }

    public async start(config: RemoteConfig): Promise<string> {
        if (this.isRunning) {
            console.log('[IndiiRemoteService] Remote service is already running on URL:', this.url);
            return this.url!;
        }

        // Mutex: if a startup is already in progress, return the pending promise
        if (this.pendingStart) {
            console.log('[IndiiRemoteService] Startup already in progress, awaiting...');
            return this.pendingStart;
        }

        // Fail closed: require a non-empty password
        if (!config.password?.trim()) {
            throw new IndiiRemoteError('INVALID_CONFIG', 'IndiiRemote requires a non-empty password. Refusing to start with default credentials.');
        }

        this.pendingStart = this._doStart(config);
        try {
            return await this.pendingStart;
        } finally {
            this.pendingStart = null;
        }
    }

    private async _doStart(config: RemoteConfig): Promise<string> {
        try {
            this.port = config.port || 3333;
            this.password = config.password;

            // 1. Setup Express
            this.expressApp = express();
            this.expressApp.use(express.json());

            // Serve the mobile dashboard from a public directory
            const dashboardPath = path.join(electronApp.getAppPath(), 'public', 'remote');
            const fallbackPath = path.join(__dirname, '..', 'public', 'remote');

            this.expressApp.use(express.static(dashboardPath));
            this.expressApp.use(express.static(fallbackPath));

            // Basic auth check endpoint — returns a session token
            this.expressApp.post('/api/auth', (req, res) => {
                const ip = req.ip || req.socket.remoteAddress || 'unknown';
                const now = Date.now();
                const attempt = this.authAttempts.get(ip);

                if (attempt && attempt.count >= 5 && now < attempt.resetAt) {
                    res.status(429).json({ success: false, error: 'Too many failed attempts. Locked out for 5 minutes.' });
                    return;
                }

                if (req.body.password === this.password) {
                    if (attempt) this.authAttempts.delete(ip);
                    // Generate a short-lived session token for WebSocket auth
                    const wsToken = crypto.randomBytes(32).toString('hex');
                    this._pendingWsTokens.add(wsToken);
                    // Expire token after 30 seconds
                    setTimeout(() => this._pendingWsTokens.delete(wsToken), 30000);
                    res.json({ success: true, wsToken });
                } else {
                    const count = (attempt && now < attempt.resetAt ? attempt.count : 0) + 1;
                    const resetAt = now + (count >= 5 ? 5 * 60 * 1000 : 5 * 60 * 1000); // the lockout resets after 5 min
                    this.authAttempts.set(ip, { count, resetAt });
                    res.status(401).json({ success: false, error: 'Invalid password' });
                }
            });

            // 2. Setup HTTP Server & WebSocket Server
            this.server = createServer(this.expressApp);
            this.wss = new WebSocketServer({ server: this.server });

            this.wss.on('connection', (ws) => {
                this.clients.add(ws);

                // Require WS auth within 10 seconds
                const authTimeout = setTimeout(() => {
                    if (!this.authenticatedClients.has(ws)) {
                        ws.close(4001, 'Authentication timeout');
                    }
                }, 10000);

                ws.on('message', (message) => {
                    try {
                        const parsed = JSON.parse(message.toString());

                        // First message must be auth
                        if (!this.authenticatedClients.has(ws)) {
                            if (parsed.type === 'auth' && this._pendingWsTokens.has(parsed.token)) {
                                this._pendingWsTokens.delete(parsed.token);
                                this.authenticatedClients.add(ws);
                                clearTimeout(authTimeout);
                                ws.send(JSON.stringify({ type: 'auth', success: true }));
                                this.broadcastStateToDesktop();
                                return;
                            } else {
                                ws.close(4003, 'Authentication required');
                                return;
                            }
                        }

                        this.handleMobileMessage(ws, parsed);
                    } catch (_e) {
                        console.error('Error handling mobile message:', _e);
                    }
                });

                ws.on('close', () => {
                    clearTimeout(authTimeout);
                    this.clients.delete(ws);
                    this.broadcastStateToDesktop();
                });
            });

            // 3. Start listening
            const listenHost = '0.0.0.0';
            await new Promise<void>((resolve) => {
                this.server!.listen(this.port, listenHost, () => {
                    resolve();
                });
            });

            // 4. Start Ngrok Tunnel
            if (config?.ngrokToken) {
                const tunnel = await ngrok.connect({
                    addr: this.port,
                    authtoken: config.ngrokToken
                });
                this.url = tunnel.url();
            } else {
                // Determine LAN IP address for P2P connection fallback
                const interfaces = os.networkInterfaces();
                let localIp = '127.0.0.1';
                for (const name of Object.keys(interfaces)) {
                    for (const iface of interfaces[name] || []) {
                        if (iface.family === 'IPv4' && !iface.internal) {
                            localIp = iface.address;
                            break;
                        }
                    }
                    if (localIp !== '127.0.0.1') break;
                }
                this.url = `http://${localIp}:${this.port}`;
            }

            this.isRunning = true;
            this.broadcastStateToDesktop();
            return this.url as string;

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            await this.stop();
            throw new IndiiRemoteError('START_FAILED', `Failed to start IndiiRemote: ${msg}`, error);
        }
    }

    /**
     * Update the password on a running service (e.g., when a new pairing session is started).
     */
    public updatePassword(newPassword: string): void {
        if (!newPassword?.trim()) {
            throw new IndiiRemoteError('INVALID_CONFIG', 'Password cannot be empty.');
        }
        this.password = newPassword;
    }

    public async stop(): Promise<void> {
        this.isRunning = false;
        this.url = null;

        // Disconnect Ngrok
        try {
            await ngrok.disconnect();
        } catch (_e) {
            // ignore
        }

        // Close WebSocket clients
        for (const client of this.clients) {
            client.terminate();
        }
        this.clients.clear();

        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }

        if (this.server) {
            this.server.close();
            this.server = null;
        }

        this.expressApp = null;
        this.broadcastStateToDesktop();
    }

    public getStatus() {
        return {
            isRunning: this.isRunning,
            url: this.url,
            clientCount: this.clients.size
        };
    }

    // --- Private State ---
    private _pendingWsTokens: Set<string> = new Set();

    // --- Message Handlers ---

    // When the phone sends a command (e.g. Pause Render, Send Message to Agent)
    private handleMobileMessage(_ws: WebSocket, payload: Record<string, unknown>) {

        // Pass to Desktop IPC bus, so the React UI can listen and react!
        const windows = electronApp.isReady() ? BrowserWindow.getAllWindows() : [];
        if (windows.length > 0) {
            const win = windows[0];
            if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
                try {
                    win.webContents.send('indii-remote:message-from-mobile', payload);
                } catch (_err) {
                    console.error('Error sending message to mobile:', _err);
                }
            }
        }
    }

    // Send a message from Desktop app -> To Mobile Phone directly via WS
    public sendToMobile(payload: Record<string, unknown>) {
        const strBytes = JSON.stringify(payload);
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN && this.authenticatedClients.has(client)) {
                client.send(strBytes);
            }
        }
    }

    private broadcastStateToDesktop() {
        const windows = electronApp.isReady() ? BrowserWindow.getAllWindows() : [];
        if (windows.length > 0) {
            const win = windows[0];
            if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
                try {
                    win.webContents.send('indii-remote:status-updated', this.getStatus());
                } catch (_err) {
                    console.error('Error broadcasting state to desktop:', _err);
                }
            }
        }
    }
}

export const indiiRemoteService = new IndiiRemoteService();
