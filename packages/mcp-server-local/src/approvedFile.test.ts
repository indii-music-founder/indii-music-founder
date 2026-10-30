import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { approvedFile } from './approvedFile';

// Actual disposable filesystem objects, not customer data or authentication fixtures.
describe('host-approved local file scope', () => {
    it('allows selected files and directory descendants while rejecting escapes and unavailable roots', async () => {
        const base = await fs.mkdtemp(path.join(os.tmpdir(), 'indii-mcp-scope-'));
        try {
            const root = path.join(base, 'approved');
            await fs.mkdir(root);
            const inside = path.join(root, 'contract.pdf');
            const outside = path.join(base, 'private.pdf');
            await fs.writeFile(inside, 'scope check');
            await fs.writeFile(outside, 'outside scope');
            const roots = [{ uri: pathToFileURL(root).href }];
            expect(await approvedFile(inside, roots)).toBe(await fs.realpath(inside));
            await expect(approvedFile(outside, roots)).rejects.toThrow('denied');
            await fs.symlink(outside, path.join(root, 'escape.pdf'));
            await expect(approvedFile(path.join(root, 'escape.pdf'), roots)).rejects.toThrow('denied');
            expect(await approvedFile(outside, [{ uri: pathToFileURL(outside).href }])).toBe(await fs.realpath(outside));
            await expect(approvedFile(inside, [])).rejects.toThrow('denied');
            await expect(approvedFile(root, roots)).rejects.toThrow('denied');
            await expect(approvedFile(inside, [{ uri: 'https://example.com/' }, { uri: pathToFileURL(path.join(base, 'missing')).href }])).rejects.toThrow('denied');
            await expect(approvedFile('relative.pdf', roots)).rejects.toThrow('absolute');
        } finally {
            await fs.rm(base, { recursive: true, force: true });
        }
    });
});
