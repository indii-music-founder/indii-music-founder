import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface HostingHeader {
    key: string;
    value: string;
}

interface HostingRule {
    source: string;
    headers: HostingHeader[];
}

interface HostingTarget {
    target: string;
    headers: HostingRule[];
}

const firebaseConfig = JSON.parse(
    readFileSync(resolve(process.cwd(), 'firebase.json'), 'utf8'),
) as { hosting: HostingTarget[] };

function target(name: string): HostingTarget {
    const found = firebaseConfig.hosting.find(entry => entry.target === name);
    if (!found) throw new Error(`Missing Firebase Hosting target: ${name}`);
    return found;
}

function header(rule: HostingRule, key: string): string {
    const found = rule.headers.find(entry => entry.key === key);
    if (!found) throw new Error(`Missing ${key} header for ${rule.source}`);
    return found.value;
}

describe('Studio Firebase Hosting policy', () => {
    it('allows same-origin device features only on the Studio target', () => {
        const studio = target('app');
        for (const source of ['/creative', '/creative/**', '**']) {
            const rule = studio.headers.find(entry => entry.source === source);
            expect(rule, `missing Studio header rule for ${source}`).toBeDefined();
            expect(header(rule!, 'Permissions-Policy')).toBe(
                'camera=(self), microphone=(self), geolocation=(self), payment=()',
            );
        }

        const landingRule = target('landing').headers.find(entry => entry.source === '**');
        expect(landingRule).toBeDefined();
        expect(header(landingRule!, 'Permissions-Policy')).toBe(
            'camera=(), microphone=(), geolocation=(), payment=()',
        );
    });

    it('allows each direct renderer integration endpoint in Studio CSP', () => {
        const studioCatchAll = target('app').headers.find(entry => entry.source === '**');
        expect(studioCatchAll).toBeDefined();
        const csp = header(studioCatchAll!, 'Content-Security-Policy');

        for (const origin of [
            'https://api.frankfurter.dev',
            'https://api.spotify.com',
            'https://graph.facebook.com',
            'https://open.tiktokapis.com',
            'https://www.googleapis.com',
            'https://youtubeanalytics.googleapis.com',
            'https://gmail.googleapis.com',
            'https://graph.microsoft.com',
            'https://api.believemusic.com',
            'https://api.onerpm.com',
            'https://api.tunecore.com',
            'https://api.unitedmasters.com',
        ]) {
            expect(csp).toContain(origin);
        }
    });
});
