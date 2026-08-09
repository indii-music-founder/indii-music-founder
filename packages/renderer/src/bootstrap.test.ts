import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const bootstrapSource = readFileSync(
    resolve(process.cwd(), 'packages/renderer/public/bootstrap.js'),
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
});
