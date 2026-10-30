import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Canonical host roots only; tool arguments never grant filesystem access. */
export async function approvedFile(filePath: unknown, roots: readonly { uri: string }[]): Promise<string> {
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) throw new Error('An absolute approved file path is required.');
    const target = await fs.realpath(filePath);
    for (const root of roots) {
        try {
            const url = new URL(root.uri);
            if (url.protocol !== 'file:') continue;
            const canonical = await fs.realpath(fileURLToPath(url));
            const relative = path.relative(canonical, target);
            if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
                if (!(await fs.stat(target)).isFile()) throw new Error('The approved path must be a regular file.');
                return target;
            }
        } catch { /* Invalid, unavailable or nonlocal roots grant nothing. */ }
    }
    throw new Error('File access denied. Select the file or folder in the desktop app first.');
}
