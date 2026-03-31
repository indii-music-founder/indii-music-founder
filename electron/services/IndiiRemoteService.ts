import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import ngrok from '@ngrok/ngrok';
import { app as electronApp, ipcMain, BrowserWindow } from 'electron';
import path from 'path';

export interface RemoteConfig {
    port?: number;
    ngrokToken?: string;
    password?: string;
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
    private clients: Set<WebSocket> = new Set();

    // Config defaults
    private port = 3333;
    private password = 'antigravity'; // Default password

    constructor() { }

    public async start(config?: RemoteConfig): Promise<string> {
        if (this.isRunning) {
            console.info('[IndiiRemoteService] Already running at:', this.url);
            return this.url!;
        }

        try {
            console.info('[IndiiRemoteService] Starting background infrastructure...');
            this.port = config?.port || 3333;
            this.password = config?.password || this.password;

            // 1. Setup Express
            this.expressApp = express();
            this.expressApp.use(express.json());

            // Serve the mobile dashboard from a public directory
            const dashboardPath = path.join(electronApp.getAppPath(), 'public', 'remote');
            this.expressApp.use(express.static(dashboardPath));

            // Basic auth check endpoint
            this.expressApp.post('/api/auth', (req, res) => {
                if (req.body.password === this.password) {
                    res.json({ success: true });
                } else {
                    res.status(401).json({ success: false, error: 'Invalid password' });
                }
            });

            // 2. Setup HTTP Server & WebSocket Server
            this.server = createServer(this.expressApp);
            this.wss = new WebSocketServer({ server: this.server });

            this.wss.on('connection', (ws) => {
                console.info('[IndiiRemoteService] Mobile client connected!');
                this.clients.add(ws);

                ws.on('message', (message) => {
                    try {
                        const parsed = JSON.parse(message.toString());
                        this.handleMobileMessage(ws, parsed);
                    } catch (e) {
                        console.error('[IndiiRemoteService] Failed to parse message', e);
                    }
                });

                ws.on('close', () => {
                    console.info('[IndiiRemoteService] Mobile client disconnected.');
                    this.clients.delete(ws);
                    this.broadcastStateToDesktop();
                });

                this.broadcastStateToDesktop();
            });

            // 3. Start listening
            await new Promise<void>((resolve) => {
                this.server!.listen(this.port, '0.0.0.0', () => {
                    resolve();
                });
            });
            console.info(`[IndiiRemoteService] Local server listening on port ${this.port}`);

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
                this.url = `http://localhost:${this.port}`;
                console.warn(`[IndiiRemoteService] No Ngrok token provided. Running locally only at ${this.url}`);
            }

            this.isRunning = true;
            this.broadcastStateToDesktop();
            return this.url as string;

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('[IndiiRemoteService] Failed to start:', error);
            this.stop();
            throw new IndiiRemoteError('START_FAILED', `Failed to start IndiiRemote: ${msg}`, error);
        }
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

    // --- Message Handlers ---

    // When the phone sends a command (e.g. Pause Render, Send Message to Agent)
    private handleMobileMessage(ws: WebSocket, payload: any) {
        console.info('[IndiiRemoteService] Received from phone:', payload);

        // Pass to Desktop IPC bus, so the React UI can listen and react!
        // We use typical Electron IPC pattern here.
        const windows = electronApp.isReady() ? BrowserWindow.getAllWindows() : [];
        if (windows.length > 0) {
            windows[0].webContents.send('indii-remote:message-from-mobile', payload);
        }
    }

    // Send a message from Desktop app -> To Mobile Phone directly via WS
    public sendToMobile(payload: any) {
        const strBytes = JSON.stringify(payload);
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
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
