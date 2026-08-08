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

  it('keeps clean installs workspace-native and packages shared for Firebase deploys', () => {
    const lock = JSON.parse(readFileSync(join(repoRoot, 'package-lock.json'), 'utf8')) as {
      packages: Record<string, {
        dependencies?: Record<string, string>;
        resolved?: string;
        link?: boolean;
      }>;
    };
    const deployWorkflow = readFileSync(join(repoRoot, '.github/workflows/deploy.yml'), 'utf8');

    expect(lock.packages['packages/firebase']?.dependencies?.['@indii/shared'])
      .toBe('*');
    expect(lock.packages['node_modules/@indii/shared'])
      .toEqual({ resolved: 'packages/shared', link: true });
    expect(deployWorkflow).toMatch(
      /cp -r packages\/shared\/dist packages\/shared\/package\.json packages\/firebase\/shared-pkg\//,
    );
    expect(deployWorkflow).toMatch(
      /npm pkg set dependencies\.@indii\/shared='file:\.\/shared-pkg' -w packages\/firebase/,
    );
  });
});

describe('Deploy workflow staging gate contract', () => {
  it('fails closed when the preview cannot deploy or serve the app', () => {
    const workflow = readFileSync(join(repoRoot, '.github/workflows/deploy.yml'), 'utf8');

    expect(workflow).toContain(
      '::error::Firebase Hosting storage quota blocked the staging deploy.',
    );
    expect(workflow).toContain("STAGING_HTTP_STATUS=$(curl -sS -o /dev/null -w '%{http_code}'");
    expect(workflow).toContain('::error::Staging URL did not become reachable: ${STAGING_URL}');
    expect(workflow).not.toContain(
      'Staging deploy skipped — production deploy unaffected.',
    );
  });

  it('requires successful staging E2E before production deploy starts', () => {
    const workflow = readFileSync(join(repoRoot, '.github/workflows/deploy.yml'), 'utf8');

    expect(workflow).toContain('needs: [deploy-staging, e2e-staging, rules-tests]');
    expect(workflow).toContain("needs.e2e-staging.result == 'success'");
  });
});
