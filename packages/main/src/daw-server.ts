import { WebSocketServer, WebSocket } from 'ws';
import log from 'electron-log';
import { EventEmitter } from 'events';

export interface DAWState {
    bpm: number;
    isPlaying: boolean;
    currentTime: number;
    trackNames: string[];
}

class DawServer extends EventEmitter {
    private wss: WebSocketServer | null = null;
    private port = 8081;
    private clients: Set<WebSocket> = new Set();
    
    private state: DAWState = {
        bpm: 120,
        isPlaying: false,
        currentTime: 0,
        trackNames: []
    };

    public start() {
        if (this.wss) return;
        
        try {
            this.wss = new WebSocketServer({ port: this.port });
            log.info(`[DawServer] Started on ws://localhost:${this.port}`);

            this.wss.on('connection', (ws) => {
                log.info('[DawServer] Client connected');
                this.clients.add(ws);
                
                // Send initial state
                ws.send(JSON.stringify({ type: 'state_update', state: this.state }));

                ws.on('message', (message) => {
                    try {
                        const data = JSON.parse(message.toString());
                        if (data.type === 'sync') {
                            this.state = { ...this.state, ...data.state };
                            this.emit('state-changed', this.state);
                        }
                    } catch (err) {
                        log.error('[DawServer] Failed to parse message', err);
                    }
                });

                ws.on('close', () => {
                    log.info('[DawServer] Client disconnected');
                    this.clients.delete(ws);
                });
            });
        } catch (error) {
            log.error('[DawServer] Failed to start:', error);
        }
    }

    public stop() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
            log.info('[DawServer] Stopped');
        }
    }

    public getState(): DAWState {
        return this.state;
    }
}

export const dawServer = new DawServer();
