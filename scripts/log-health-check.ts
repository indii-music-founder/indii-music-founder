import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  summarizeHealthResults,
  type VitestHealthResults,
} from './health-check-results.js';

const execFileAsync = promisify(execFile);

async function runHealthCheck(): Promise<void> {
  const tmpFile = join(tmpdir(), `vitest-results-${process.pid}-${Date.now()}.json`);

  try {
    console.log('Running integration tests for health check...');
    let runnerSucceeded = true;
    try {
      await execFileAsync('npx', [
        'vitest',
        'run',
        'integration.test.ts',
        '--reporter=json',
        `--outputFile=${tmpFile}`,
      ], { timeout: 600000 });
    } catch {
      runnerSucceeded = false;
    }

    if (!existsSync(tmpFile)) {
      throw new Error(`Vitest did not produce its health result file at ${tmpFile}.`);
    }

    const results = JSON.parse(readFileSync(tmpFile, 'utf-8')) as VitestHealthResults;
    const summary = summarizeHealthResults(results, runnerSucceeded);

    console.log(
      `Test Pass Rate: ${summary.passRate} `
      + `(${summary.passedTests}/${summary.executedTests} executed; `
      + `${summary.skippedTests} skipped/pending; ${summary.discoveredTests} discovered)`,
    );
    console.log(`Latency p50: ${summary.p50}ms, p99: ${summary.p99}ms`);

    if (getApps().length === 0) initializeApp();
    const db = getFirestore();
    await db.collection('healthChecks').add({
      schemaVersion: 'health-check.v2',
      timestamp: FieldValue.serverTimestamp(),
      status: summary.healthy ? 'passed' : 'failed',
      testCount: summary.executedTests,
      discoveredTestCount: summary.discoveredTests,
      passedTestCount: summary.passedTests,
      failedTestCount: summary.failedTests,
      skippedTestCount: summary.skippedTests,
      testPassRate: summary.passRate,
      latencies: {
        p50: summary.p50,
        p99: summary.p99,
      },
    });
    console.log('Successfully wrote health check results to Firestore.');

    if (!summary.healthy) {
      throw new Error(
        `Health tests failed: ${summary.failedTests} failed, `
        + `${summary.executedTests} executed, runnerSucceeded=${runnerSucceeded}.`,
      );
    }
  } finally {
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
  }
}

runHealthCheck().catch(error => {
  console.error('Failed to run health check:', error);
  process.exitCode = 1;
});
