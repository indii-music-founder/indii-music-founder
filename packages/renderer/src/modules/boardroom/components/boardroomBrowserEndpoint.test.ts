import { describe, expect, it } from 'vitest';
import { resolveBoardroomBrowserEndpoint } from './boardroomBrowserEndpoint';

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

    it('accepts a configured secure endpoint in deployed environments', () => {
        expect(resolveBoardroomBrowserEndpoint({
            enabled: true,
            configuredEndpoint: 'wss://browser.example/boardroom',
            isDev: false,
            hostname: 'app.indii.music',
        })).toBe('wss://browser.example/boardroom');
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
