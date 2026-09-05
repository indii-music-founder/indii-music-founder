import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

// Resolve relative to THIS file, not process.cwd(): the suite must behave
// identically whether vitest is launched from the repo root (CI, npm test)
// or from packages/renderer.
const bootstrapSource = readFileSync(
    resolve(__dirname, '../public/bootstrap.js'),
    'utf8'
);

function runBootstrap(hostname: string) {
    const replace = vi.fn();
    const localStorage = { setItem: vi.fn() };
    const window = {
        location: {
            hostname,
            pathname: '/privacy',
            search: '?source=hosting',
            hash: '#policy',
            replace,
        },
        localStorage,
    };

    runInNewContext(bootstrapSource, {
        console,
        localStorage,
        URLSearchParams,
        window,
    });

    return { localStorage, replace, window };
}

describe('renderer hosting bootstrap (structural)', () => {
    it.each([
        'indii-music-studio.web.app',
        'indii-music-studio.firebaseapp.com',
    ])('canonicalizes the live Firebase alias %s', hostname => {
        const { replace } = runBootstrap(hostname);

        expect(replace).toHaveBeenCalledWith(
            'https://indii.music/privacy?source=hosting#policy'
        );
    });

    it('keeps Firebase preview channels on their freshly deployed host', () => {
        const { replace } = runBootstrap(
            'indii-music-studio--staging-g6kqlzcr.web.app'
        );

        expect(replace).not.toHaveBeenCalled();
    });

    it('does not canonicalize unrelated Firebase project hosts', () => {
        const { replace } = runBootstrap('another-project.web.app');

        expect(replace).not.toHaveBeenCalled();
    });

    it('intercepts firelog telemetry fetch and returns synthetic 200 OK without calling original fetch', async () => {
        const originalFetch = vi.fn();
        const fakeWindow: any = {
            location: {
                hostname: 'localhost',
                pathname: '/',
                search: '',
                hash: '',
                replace: vi.fn(),
            },
            localStorage: { setItem: vi.fn() },
            fetch: originalFetch,
        };

        runInNewContext(bootstrapSource, {
            console,
            localStorage: fakeWindow.localStorage,
            URLSearchParams,
            window: fakeWindow,
            Response,
        });

        const firelogUrl = 'https://firebaselogging-pa.googleapis.com/v1/firelog/legacy/log?key=AIzaSyFakeKey';
        const response = await fakeWindow.fetch(firelogUrl, { method: 'POST', body: '{}' });

        expect(response.status).toBe(200);
        expect(originalFetch).not.toHaveBeenCalled();
        const body = await response.json();
        expect(body.nextRequestWaitMillis).toBe('86400000');
    });

    it('passes non-firelog fetch calls through to original fetch', async () => {
        const originalFetch = vi.fn().mockResolvedValue(new Response('{"data":123}', { status: 200 }));
        const fakeWindow: any = {
            location: {
                hostname: 'localhost',
                pathname: '/',
                search: '',
                hash: '',
                replace: vi.fn(),
            },
            localStorage: { setItem: vi.fn() },
            fetch: originalFetch,
        };

        runInNewContext(bootstrapSource, {
            console,
            localStorage: fakeWindow.localStorage,
            URLSearchParams,
            window: fakeWindow,
            Response,
        });

        const appUrl = 'https://firestore.googleapis.com/v1/projects/my-project';
        const response = await fakeWindow.fetch(appUrl, { method: 'GET' });

        expect(originalFetch).toHaveBeenCalledWith(appUrl, { method: 'GET' });
        expect(response.status).toBe(200);
    });

    it('intercepts firelog sendBeacon and returns true without calling original sendBeacon', () => {
        const originalSendBeacon = vi.fn();
        const fakeNavigator = {
            sendBeacon: originalSendBeacon,
        };
        const fakeWindow: any = {
            location: {
                hostname: 'localhost',
                pathname: '/',
                search: '',
                hash: '',
                replace: vi.fn(),
            },
            localStorage: { setItem: vi.fn() },
        };

        runInNewContext(bootstrapSource, {
            console,
            localStorage: fakeWindow.localStorage,
            URLSearchParams,
            window: fakeWindow,
            navigator: fakeNavigator,
        });

        const firelogUrl = 'https://firebaselogging-pa.googleapis.com/v1/firelog/legacy/log';
        const result = fakeNavigator.sendBeacon(firelogUrl, 'payload');

        expect(result).toBe(true);
        expect(originalSendBeacon).not.toHaveBeenCalled();
    });

    it('passes non-firelog sendBeacon calls through to original sendBeacon', () => {
        const originalSendBeacon = vi.fn().mockReturnValue(true);
        const fakeNavigator = {
            sendBeacon: originalSendBeacon,
        };
        const fakeWindow: any = {
            location: {
                hostname: 'localhost',
                pathname: '/',
                search: '',
                hash: '',
                replace: vi.fn(),
            },
            localStorage: { setItem: vi.fn() },
        };

        runInNewContext(bootstrapSource, {
            console,
            localStorage: fakeWindow.localStorage,
            URLSearchParams,
            window: fakeWindow,
            navigator: fakeNavigator,
        });

        const analyticsUrl = 'https://custom-analytics.example.com/beacon';
        const result = fakeNavigator.sendBeacon(analyticsUrl, 'payload');

        expect(result).toBe(true);
        expect(originalSendBeacon).toHaveBeenCalledWith(analyticsUrl, 'payload');
    });
});
