import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

describe('mobile push worker', () => {
    it('shows an owned notification and rejects a cross-origin target', async () => {
        const handlers = new Map<string, (event: unknown) => void>();
        const showNotification = vi.fn().mockResolvedValue(undefined);
        const worker = {
            location: { origin: 'https://app.indii.music' },
            registration: { showNotification },
            clients: { matchAll: vi.fn().mockResolvedValue([]), openWindow: vi.fn() },
            addEventListener: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler),
        };
        const source = readFileSync(resolve(process.cwd(), 'packages/renderer/public/firebase-messaging-sw.js'), 'utf8');
        runInNewContext(source, { self: worker, URL });
        let pending: Promise<unknown> | undefined;
        const event = (url: string) => ({
            data: { json: () => ({ data: { title: 'Studio video ready', body: 'Open Studio', url } }) },
            waitUntil: (promise: Promise<unknown>) => { pending = promise; },
        });
        handlers.get('push')?.(event('https://evil.example/steal'));
        expect(showNotification).not.toHaveBeenCalled();
        handlers.get('push')?.(event('https://app.indii.music/mobile-remote?tab=studio'));
        await pending;
        expect(showNotification).toHaveBeenCalledWith('Studio video ready', expect.objectContaining({
            data: { url: 'https://app.indii.music/mobile-remote?tab=studio' },
        }));
        handlers.get('notificationclick')?.({
            notification: { data: { url: 'https://app.indii.music/mobile-remote?tab=studio' }, close: vi.fn() },
            waitUntil: (promise: Promise<unknown>) => { pending = promise; },
        });
        await pending;
        expect(worker.clients.openWindow).toHaveBeenCalledWith('https://app.indii.music/mobile-remote?tab=studio');
    });
});
