import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import ngrok from '@ngrok/ngrok';
import { app as electronApp, BrowserWindow } from 'electron';
import path from 'path';
import crypto from 'crypto';

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

    constructor() { }

    public async start(config: RemoteConfig): Promise<string> {
        if (this.isRunning) {
            console.info('[IndiiRemoteService] Already running at:', this.url);
            return this.url!;
        }

        // Mutex: if a startup is already in progress, return the pending promise
        if (this.pendingStart) {
            console.info('[IndiiRemoteService] Startup already in progress, waiting...');
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
            console.info('[IndiiRemoteService] Starting background infrastructure...');
            this.port = config.port || 3333;
            this.password = config.password;

            // 1. Setup Express
            this.expressApp = express();
            this.expressApp.use(express.json());

            // Serve the mobile dashboard from a public directory
            const dashboardPath = path.join(electronApp.getAppPath(), 'public', 'remote');
            const fallbackPath = path.join(__dirname, '..', 'public', 'remote');

            this.expressApp.use('/remote', express.static(dashboardPath));
            this.expressApp.use('/remote', express.static(fallbackPath));

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
                console.info('[IndiiRemoteService] Mobile client connected — awaiting auth...');
                this.clients.add(ws);

                // Require WS auth within 10 seconds
                const authTimeout = setTimeout(() => {
                    if (!this.authenticatedClients.has(ws)) {
                        console.warn('[IndiiRemoteService] Client failed to authenticate in time, disconnecting.');
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
                                console.info('[IndiiRemoteService] Client authenticated via WS token.');
                                this.broadcastStateToDesktop();
                                return;
                            } else {
                                ws.close(4003, 'Authentication required');
                                return;
                            }
                        }

                        this.handleMobileMessage(ws, parsed);
                    } catch (e) {
                        console.error('[IndiiRemoteService] Failed to parse message', e);
                    }
                });

                ws.on('close', () => {
                    console.info('[IndiiRemoteService] Mobile client disconnected.');
                    clearTimeout(authTimeout);
                    this.clients.delete(ws);
                    this.broadcastStateToDesktop();
                });
            });

            // 3. Start listening
            const listenHost = config?.ngrokToken ? '0.0.0.0' : '127.0.0.1';
            await new Promise<void>((resolve) => {
                this.server!.listen(this.port, listenHost, () => {
                    resolve();
                });
            });
            console.info(`[IndiiRemoteService] Local server listening on http://${listenHost}:${this.port}`);

            // 4. Start Ngrok Tunnel
            if (config?.ngrokToken) {
                console.info(`[IndiiRemoteService] Establishing secure Ngrok tunnel...`);
                const tunnel = await ngrok.connect({
                    addr: this.port,
                    authtoken: config.ngrokToken
                });
                this.url = tunnel.url();
                console.info(`[IndiiRemoteService] GLOBAL ACCESS URL: ${this.url}`);
            } else {
                this.url = `http://${listenHost}:${this.port}`;
                console.warn(`[IndiiRemoteService] No Ngrok token provided. Running locally only at ${this.url}`);
            }

            this.isRunning = true;
            this.broadcastStateToDesktop();
            return this.url as string;

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('[IndiiRemoteService] Failed to start:', error);
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
        console.info('[IndiiRemoteService] Password updated for new pairing session.');
    }

    public async stop(): Promise<void> {
        console.info('[IndiiRemoteService] Shutting down remote service...');
        this.isRunning = false;
        this.url = null;

        // Disconnect Ngrok
        try {
            await ngrok.disconnect();
        } catch (e) {
            console.error('[IndiiRemoteService] Error disconnecting ngrok:', e);
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
        console.info('[IndiiRemoteService] Shutdown complete.');
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
        console.info('[IndiiRemoteService] Received from phone:', payload);

        // Pass to Desktop IPC bus, so the React UI can listen and react!
        const windows = electronApp.isReady() ? BrowserWindow.getAllWindows() : [];
        if (windows.length > 0) {
            windows[0].webContents.send('indii-remote:message-from-mobile', payload);
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
            windows[0].webContents.send('indii-remote:status-updated', this.getStatus());
        }
    }
}

export const indiiRemoteService = new IndiiRemoteService();
