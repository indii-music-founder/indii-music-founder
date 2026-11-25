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

describe('Boardroom class hygiene (ISSUE-1651 / ISSUE-1652 / ISSUE-1647 / ISSUE-1648)', () => {
    it('uses no undefined animation, tiny sub-10px text, unprefixed animations, or blue-black hex backgrounds', () => {
        const offenders = sources(root).flatMap(file => {
            const text = readFileSync(file, 'utf8');
            const issues: string[] = [];
            for (const cls of ['animate-fadeIn', 'py-0.2', 'text-[7px]', 'text-[8px]']) {
                if (new RegExp(`(^|[\\s"'\`])${cls.replace('.', '\\.').replace('[', '\\[').replace(']', '\\]')}($|[\\s"'\`])`).test(text)) {
                    issues.push(`${file.slice(root.length + 1)}: ${cls}`);
                }
            }
            if (/(?:^|[\s"'`])animate-(?:ping|pulse|bounce|spin)(?=$|[\s"'`])/.test(text)) {
                issues.push(`${file.slice(root.length + 1)}: unprefixed animate-(ping|pulse|bounce|spin)`);
            }
            if (/\bbg-\[#0/.test(text) || /\bbg-zinc-950\b/.test(text) || /\bbg-slate-900\b/.test(text)) {
                issues.push(`${file.slice(root.length + 1)}: non-token dark background`);
            }
            return issues;
        });
        expect(offenders).toEqual([]);
    });
});
