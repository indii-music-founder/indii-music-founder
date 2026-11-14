import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function walkFiles(dir: string, predicate: (filePath: string) => boolean): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, predicate));
    } else if (predicate(full)) {
      results.push(full);
    }
  }
  return results;
}

describe('Electron Main IPC channel allowlist parity (ISSUE-1558)', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const mainSrcDir = path.join(repoRoot, 'packages/main/src');

  it('includes computer:click, computer:key, and computer:scroll and every static ipcMain.handle channel in KNOWN_IPC_CHANNELS', () => {
    const mainTs = fs.readFileSync(path.join(mainSrcDir, 'main.ts'), 'utf8');
    const allowlistMatch = mainTs.match(/const KNOWN_IPC_CHANNELS = new Set\(\[([\s\S]*?)\]\);/);
    expect(allowlistMatch).not.toBeNull();

    const allowed = new Set(
      Array.from(allowlistMatch![1]!.matchAll(/'([^']+)'/g), (m) => m[1]!),
    );

    expect(allowed.has('computer:click')).toBe(true);
    expect(allowed.has('computer:key')).toBe(true);
    expect(allowed.has('computer:scroll')).toBe(true);

    const tsFiles = walkFiles(mainSrcDir, (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    const missing: string[] = [];
    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      for (const m of content.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)) {
        const channel = m[1]!;
        if (!allowed.has(channel)) {
          missing.push(`${channel} (${path.relative(repoRoot, file)})`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('has zero leftover .orig merge backup files under packages/', () => {
    const origFiles = walkFiles(path.join(repoRoot, 'packages'), (f) => f.endsWith('.orig'));
    expect(origFiles).toEqual([]);
  });
});
