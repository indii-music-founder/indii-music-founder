import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ISSUE-1651: class names with no matching utility silently do nothing.
const root = resolve(__dirname);
const sources = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [path] : [];
});

describe('Boardroom class hygiene (ISSUE-1651)', () => {
    it('uses no undefined animation or spacing classes', () => {
        const offenders = sources(root).flatMap(file => {
            const text = readFileSync(file, 'utf8');
            return ['animate-fadeIn', 'py-0.2'].filter(cls => new RegExp(`(^|[\\s"'\`])${cls.replace('.', '\\.')}($|[\\s"'\`])`).test(text))
                .map(cls => `${file.slice(root.length + 1)}: ${cls}`);
        });
        expect(offenders).toEqual([]);
    });
});
