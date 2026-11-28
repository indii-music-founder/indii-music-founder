import { describe, expect, it } from 'vitest';
import { resolveBoardroomBrowserEndpoint } from '@/modules/boardroom/components/boardroomBrowserEndpoint';

describe('resolveBoardroomBrowserEndpoint', () => {
    it('keeps the hosted browser disabled unless explicitly enabled', () => {
        expect(resolveBoardroomBrowserEndpoint({
            enabled: false,
            configuredEndpoint: 'wss://browser.example/boardroom',
            isDev: false,
            hostname: 'app.indii.music',
        })).toBeUndefined();
    });

    it('uses the loopback worker in local browser development', () => {
        expect(resolveBoardroomBrowserEndpoint({
            enabled: true,
            isDev: true,
            hostname: 'localhost',
        })).toBe('ws://127.0.0.1:4245/boardroom');
    });

    it.each([
        'wss://boardroom-browser-148015878263.us-central1.run.app',
        'wss://boardroom-browser-148015878263.us-central1.run.app/boardroom',
    ])('uses the Boardroom WebSocket route for %s', configuredEndpoint => {
        expect(resolveBoardroomBrowserEndpoint({
            enabled: true,
            configuredEndpoint,
            isDev: false,
            hostname: 'app.indii.music',
        })).toBe('wss://boardroom-browser-148015878263.us-central1.run.app/boardroom');
    });

    it.each([
        'ws://browser.example/boardroom',
        'wss://user:secret@browser.example/boardroom',
        'wss://browser.example/other',
        'wss://browser.example/boardroom?token=secret',
    ])('rejects an unsafe or unsupported endpoint: %s', configuredEndpoint => {
        expect(resolveBoardroomBrowserEndpoint({
            enabled: true,
            configuredEndpoint,
            isDev: false,
            hostname: 'app.indii.music',
        })).toBeUndefined();
    });
});
