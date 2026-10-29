import { WebSocketServer, WebSocket } from 'ws';
import log from 'electron-log';
import { EventEmitter } from 'node:events';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export interface DAWState {
    bpm: number;
    isPlaying: boolean;
    currentTime: number;
    trackNames: string[];
}

const initialState = (): DAWState => ({ bpm: 120, isPlaying: false, currentTime: 0, trackNames: [] });
const SyncMessage = z.object({
    type: z.literal('sync'),
    state: z.object({
        bpm: z.number().finite().positive().optional(),
        isPlaying: z.boolean().optional(),
        currentTime: z.number().finite().optional(),
        trackNames: z.array(z.string().max(256)).max(512).optional(),
    }).strict(),
}).strict();

function validCredential(header: unknown, token: string): boolean {
    if (typeof header !== 'string' || !/^Bearer [a-f0-9]{64}$/.test(header)) return false;
    const digest = (value: string) => createHash('sha256').update(value).digest();
    return timingSafeEqual(digest(header.slice(7)), digest(token));
}

export class DawServer extends EventEmitter {
    private wss: WebSocketServer | null = null;
    private token: string | null = null;
    private clients = new Set<WebSocket>();
    private state = initialState();
    private starting: Promise<void> | null = null;
    private stopping: Promise<void> | null = null;

    constructor(private readonly port = 8081) { super(); }

    public async start(): Promise<void> {
        if (this.stopping) await this.stopping;
        if (this.starting) return this.starting;
        if (this.wss) return;
        const token = randomBytes(32).toString('hex');
        const server = new WebSocketServer({
            host: '127.0.0.1', port: this.port, maxPayload: 64 * 1024,
            verifyClient: ({ req }, done) => {
                // Native companion only. Browsers always send Origin; even
                // 'null' is denied, including with a leaked pairing credential.
                if (req.headers.origin !== undefined) return done(false, 403, 'Forbidden');
                if (this.wss !== server || !validCredential(req.headers.authorization, token)) {
                    return done(false, 401, 'Unauthorized');
                }
                done(true);
            },
        });
        this.wss = server;
        this.token = token;
        const ready = new Promise<void>((resolve, reject) => {
            server.once('listening', resolve);
            server.on('error', error => {
                log.error('[DawServer] Listener error:', error);
                if (this.wss === server) {
                    this.wss = null;
                    this.token = null;
                    for (const client of this.clients) client.terminate();
                    this.clients.clear();
                    this.state = initialState();
                }
                server.close(() => undefined);
                reject(error);
                // EventEmitter's unhandled 'error' event otherwise crashes the
                // main process. The rejected start promise carries bind errors.
                if (this.listenerCount('error') > 0) this.emit('error', error);
            });
        });
        server.on('connection', ws => {
            if (this.wss !== server) { ws.terminate(); return; }
            this.clients.add(ws);
            ws.on('error', error => log.warn('[DawServer] Client socket error:', error));
            ws.on('close', () => this.clients.delete(ws));
            ws.send(JSON.stringify({ type: 'state_update', state: this.state }));
            ws.on('message', message => {
                if (this.wss !== server) return;
                try {
                    const data = SyncMessage.parse(JSON.parse(message.toString()));
                    this.state = { ...this.state, ...data.state };
                    this.emit('state-changed', this.getState());
                } catch {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'parse_error', error: 'Invalid DAW sync message' }));
                    }
                }
            });
        });
        const starting = ready.then(() => {
            if (this.wss !== server) throw new Error('DAW start cancelled');
            log.info('[DawServer] Loopback listener ready');
        }).finally(() => { if (this.starting === starting) this.starting = null; });
        this.starting = starting;
        return starting;
    }

    public async stop(): Promise<void> {
        if (this.stopping) return this.stopping;
        const server = this.wss;
        if (!server) return;
        this.wss = null;
        this.token = null;
        this.state = initialState();
        for (const client of this.clients) client.terminate();
        this.clients.clear();
        const pending = this.starting;
        const stopping = (async () => {
            // Let a pending bind settle before closing its listener, so stop
            // cannot leave a late-listening socket behind.
            await pending?.catch(() => undefined);
            await new Promise<void>(resolve => server.close(() => resolve()));
        })().finally(() => { if (this.stopping === stopping) this.stopping = null; });
        this.stopping = stopping;
        return stopping;
    }

    /** Call only through validated IPC; never log or persist the pairing credential. */
    public getConnectionInfo(): { url: string; token: string } | null {
        const address = this.wss?.address();
        if (!address || typeof address === 'string' || !this.token) return null;
        return { url: `ws://127.0.0.1:${address.port}`, token: this.token };
    }

    public getState(): DAWState {
        return { ...this.state, trackNames: [...this.state.trackNames] };
    }
}

export const dawServer = new DawServer();
