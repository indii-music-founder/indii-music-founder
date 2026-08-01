import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

function findRepoRoot(start: string): string {
  let candidate = start;
  while (dirname(candidate) !== candidate) {
    if (
      existsSync(join(candidate, 'package-lock.json'))
      && existsSync(join(candidate, '.github/workflows/health-check.yml'))
    ) {
      return candidate;
    }
    candidate = dirname(candidate);
  }
  throw new Error('Unable to locate repository root for Health Check contract test');
}

const repoRoot = findRepoRoot(process.cwd());

describe('Health Check workflow clean-install contract', () => {
  it('runs on the repository Node 24 runtime', () => {
    const workflow = readFileSync(join(repoRoot, '.github/workflows/health-check.yml'), 'utf8');
    const rootPackage = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      engines: { node: string };
    };

    expect(rootPackage.engines.node).toBe('>=24.0.0');
    expect(workflow).toMatch(/node-version:\s*['"]24\.x['"]/);
  });

  it('locks the Firebase deploy-packaged shared workspace dependency', () => {
    const lock = JSON.parse(readFileSync(join(repoRoot, 'package-lock.json'), 'utf8')) as {
      packages: Record<string, {
        dependencies?: Record<string, string>;
        resolved?: string;
        link?: boolean;
      }>;
    };

    expect(lock.packages['packages/firebase']?.dependencies?.['@indii/shared'])
      .toBe('file:./shared-pkg');
    expect(lock.packages['packages/firebase/node_modules/@indii/shared'])
      .toEqual({ resolved: 'packages/firebase/shared-pkg', link: true });
    expect(lock.packages['packages/firebase/shared-pkg']).toEqual({});
  });
});
