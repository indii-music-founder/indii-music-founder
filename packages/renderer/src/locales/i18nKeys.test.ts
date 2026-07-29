import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import en from './en.json';

/**
 * ISSUE-1268: commit 51f1d34f8 replaced literal placeholder strings with t('module.key')
 * calls across the codebase but never wrote the keys into en.json. Nothing failed
 * loudly — i18next silently falls back to echoing the raw key string in the UI.
 * This test makes that failure mode loud: every literal `t('...')` key referenced
 * anywhere in renderer source must exist in en.json.
 */

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            keys.push(...flattenKeys(value as Record<string, unknown>, full));
        } else {
            keys.push(full);
        }
    }
    return keys;
}

function collectSourceFiles(dir: string, files: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'locales') continue;
            collectSourceFiles(full, files);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
            files.push(full);
        }
    }
    return files;
}

// Keys that look missing to the static scan but are known-safe:
// dynamic-key concatenation (`t('dashboard.features.' + key)`) can't be resolved
// statically; the base prefix is not itself a translation key.
const KNOWN_DYNAMIC_PREFIXES = ['dashboard.features.'];

describe('i18n key coverage (ISSUE-1268 regression guard)', () => {
    it('every literal t(...) key referenced in renderer source exists in en.json', () => {
        const knownKeys = new Set(flattenKeys(en));
        const rendererSrc = path.resolve(__dirname, '..');
        const files = collectSourceFiles(rendererSrc);

        const literalCallPattern = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;
        const missing = new Map<string, string[]>();

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            let match: RegExpExecArray | null;
            while ((match = literalCallPattern.exec(content))) {
                const key = match[1];
                if (!key.includes('.')) continue; // unnamespaced — likely an unrelated `t` helper, not i18next
                if (KNOWN_DYNAMIC_PREFIXES.some(prefix => key.startsWith(prefix))) continue;
                if (knownKeys.has(key)) continue;

                const relPath = path.relative(rendererSrc, file);
                if (!missing.has(key)) missing.set(key, []);
                missing.get(key)!.push(relPath);
            }
        }

        if (missing.size > 0) {
            const report = Array.from(missing.entries())
                .map(([key, locations]) => `  ${key}  (${locations.join(', ')})`)
                .join('\n');
            throw new Error(
                `${missing.size} translation key(s) are referenced via t() but missing from en.json — they will render as raw uppercase keys in production:\n${report}`
            );
        }

        expect(missing.size).toBe(0);
    });
});
