import { existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, symlinkSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
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
      /npm pack \.\/packages\/shared --pack-destination packages\/firebase/,
    );
  });

  it('creates a standalone deployment lock without inheriting workspace links', () => {
    // Real npm + filesystem integration for packaging; not production user evidence.
    const workflow = readFileSync(join(repoRoot, '.github/workflows/deploy.yml'), 'utf8');
    const lockCommand = workflow.match(/FUNCTIONS_LOCK_DIR=\$\(mktemp -d\)[\s\S]+?rm -rf "\$FUNCTIONS_LOCK_DIR"/)?.[0];
    const manifestCommand = workflow.match(/SHARED_TGZ_NAME="\$SHARED_TGZ_NAME" node <<'NODE'[\s\S]+?\n {10}NODE/)?.[0].replace(/^ {10}/gm, '');
    expect(lockCommand).toBeDefined();
    expect(manifestCommand).toBeDefined();
    const fixture = mkdtempSync(join(tmpdir(), 'functions-lock-check-'));
    const shared = join(fixture, 'packages/shared');
    const functions = join(fixture, 'packages/firebase');
    try {
      mkdirSync(shared, { recursive: true });
      mkdirSync(functions, { recursive: true });
      writeFileSync(join(fixture, 'package.json'), JSON.stringify({ name: 'packaging-check', private: true, workspaces: ['packages/*'] }));
      writeFileSync(join(shared, 'package.json'), JSON.stringify({ name: '@indii/shared', version: '0.0.1' }));
      const tarball = execFileSync('npm', ['pack', '--quiet'], { cwd: shared, encoding: 'utf8' }).trim();
      copyFileSync(join(shared, tarball), join(functions, tarball));
      writeFileSync(join(functions, 'package.json'), JSON.stringify({ name: '@indii/firebase', version: '0.0.1', dependencies: { '@indii/shared': '*' } }));
      mkdirSync(join(fixture, 'node_modules/@indii'), { recursive: true });
      symlinkSync(shared, join(fixture, 'node_modules/@indii/shared'), 'dir');
      execFileSync('bash', ['-euo', 'pipefail', '-c', `${manifestCommand!}\n${lockCommand!}`], { cwd: fixture, env: { ...process.env, SHARED_TGZ_NAME: tarball }, stdio: 'pipe' });
      const lock = JSON.parse(readFileSync(join(functions, 'package-lock.json'), 'utf8'));
      expect(lock.packages[''].dependencies['@indii/shared']).toBe(`file:./${tarball}`);
      expect(lock.packages['node_modules/@indii/shared'].resolved).toBe(`file:${tarball}`);
      expect(lock.packages['node_modules/@indii/shared'].link).not.toBe(true);
      expect(existsSync(join(fixture, 'package-lock.json'))).toBe(false);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }, 30_000);

  it('pins the Cloud Build npm runtime past the Node 22 Arborist install crash', () => {
    const firebasePackage = JSON.parse(
      readFileSync(join(repoRoot, 'packages/firebase/package.json'), 'utf8'),
    ) as { engines: { node: string; npm: string } };

    expect(firebasePackage.engines).toEqual({ node: '22', npm: '11.20.0' });
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

    expect(workflow).toContain('needs: [build, deploy-staging, e2e-staging, rules-tests]');
    expect(workflow).toContain("needs.e2e-staging.result == 'success'");
  });

  it('fails closed on Firebase Functions errors and verifies the cloud render dispatcher', () => {
    const workflow = readFileSync(join(repoRoot, '.github/workflows/deploy.yml'), 'utf8');

    // MIG-010: dispatchCloudVideoRender was partially deployed as HTTPS; Gen2
    // cannot change trigger type in place. Delete pre-step is required so the
    // background-triggered version can deploy fresh.
    expect(workflow).toContain('firebase functions:delete dispatchCloudVideoRender');
    expect(workflow).toContain('deploy_status=${PIPESTATUS[0]}');
    expect(workflow).toContain('[ "$deploy_status" -eq 0 ]');
    expect(workflow).toContain("--format='value(eventTrigger.eventType)'");
    expect(workflow).toContain(
      'dispatchCloudVideoRender is missing or does not have the required Firestore created trigger.',
    );
  });
});
