import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { once } from 'node:events';
import { DawServer } from './daw-server';

// Real loopback sockets and process-local pairing credentials. No DAW/plugin,
// cloud account, authenticated customer or external-service simulation.
describe('DAW loopback authorization and lifecycle', () => {
    let server: DawServer;
    beforeEach(() => { server = new DawServer(0); });
    afterEach(async () => { await server.stop(); });

    async function rejected(url: string, headers: Record<string, string> = {}) {
        const socket = new WebSocket(url, { headers });
        const failure = await new Promise<Error>(resolve => socket.once('error', resolve));
        socket.terminate();
        return failure.message;
    }
    async function connected() {
        const info = server.getConnectionInfo()!;
        const socket = new WebSocket(info.url, { headers: { Authorization: `Bearer ${info.token}` } });
        const initial = once(socket, 'message');
        await once(socket, 'open');
        const [message] = await initial;
        return { socket, state: JSON.parse(message.toString()) };
    }
    it('exposes details only after binding and rejects missing/incorrect credentials before state delivery', async () => {
        expect(server.getConnectionInfo()).toBeNull();
        await server.start();
        const info = server.getConnectionInfo()!;
        expect(info.url).toMatch(/^ws:\/\/127\.0\.0\.1:/);
        expect(await rejected(info.url)).toContain('401');
        expect(await rejected(info.url, { Authorization: `Bearer ${'0'.repeat(64)}` })).toContain('401');
        const { socket, state } = await connected();
        expect(state.type).toBe('state_update');
        socket.close();
    });
    it('rejects every browser Origin, even with the correct credential', async () => {
        await server.start();
        const info = server.getConnectionInfo()!;
        for (const origin of ['https://example.com', 'null', 'http://localhost:5173']) {
            expect(await rejected(info.url, { Authorization: `Bearer ${info.token}`, Origin: origin })).toContain('403');
        }
    });
    it('validates sync fields before emitting or mutating state', async () => {
        await server.start();
        const { socket } = await connected();
        const error = once(socket, 'message');
        socket.send(JSON.stringify({ type: 'sync', state: { bpm: -1, arbitrary: 'injected' } }));
        const [message] = await error;
        expect(JSON.parse(message.toString()).type).toBe('parse_error');
        expect(server.getState().bpm).toBe(120);
        const change = once(server, 'state-changed');
        socket.send(JSON.stringify({ type: 'sync', state: { bpm: 95, trackNames: ['Track'] } }));
        await change;
        const copy = server.getState();
        copy.trackNames.push('mutated');
        expect(server.getState()).toMatchObject({ bpm: 95, trackNames: ['Track'] });
        socket.close();
    });
    it('terminates clients, resets state and rotates pairing on restart', async () => {
        await server.start();
        const previous = server.getConnectionInfo()!;
        const { socket } = await connected();
        const closed = once(socket, 'close');
        await server.stop();
        await closed;
        expect(server.getConnectionInfo()).toBeNull();
        await server.start();
        const next = server.getConnectionInfo()!;
        expect(next.token).not.toBe(previous.token);
        expect(await rejected(next.url, { Authorization: `Bearer ${previous.token}` })).toContain('401');
        expect(server.getState().trackNames).toEqual([]);
    });
    it('reports a real bind failure and permits recovery after the port is released', async () => {
        await server.start();
        const port = Number(new URL(server.getConnectionInfo()!.url).port);
        const contender = new DawServer(port);
        try {
            await expect(contender.start()).rejects.toMatchObject({ code: 'EADDRINUSE' });
            expect(contender.getConnectionInfo()).toBeNull();
            await server.stop();
            await contender.start();
            expect(contender.getConnectionInfo()).not.toBeNull();
        } finally {
            await contender.stop();
        }
    });
    it('settles a pending start/stop without leaving a late listener', async () => {
        await server.start();
        const port = Number(new URL(server.getConnectionInfo()!.url).port);
        await server.stop();
        server = new DawServer(port);
        const started = server.start().catch(error => error);
        await server.stop();
        await started;
        expect(server.getConnectionInfo()).toBeNull();
        await server.start();
        expect(server.getConnectionInfo()).not.toBeNull();
    });
});
