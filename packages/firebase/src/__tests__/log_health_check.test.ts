import { describe, expect, it } from 'vitest';

import {
  summarizeHealthResults,
  type VitestHealthResults,
} from '../../../../scripts/health-check-results.js';

function results(overrides: Partial<VitestHealthResults> = {}): VitestHealthResults {
  return {
    success: true,
    numTotalTests: 103,
    numPassedTests: 13,
    numFailedTests: 0,
    testResults: [
      {
        assertionResults: [
          { duration: 10 },
          { duration: 30 },
          { duration: 20 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('scheduled health-check result accounting', () => {
  it('reports pass rate across executed tests and records skipped discoveries separately', () => {
    const summary = summarizeHealthResults(results(), true);

    expect(summary).toMatchObject({
      healthy: true,
      discoveredTests: 103,
      executedTests: 13,
      passedTests: 13,
      failedTests: 0,
      skippedTests: 90,
      passRate: '100%',
      p50: 20,
      p99: 30,
    });
  });

  it('fails health when Vitest reports a failed assertion', () => {
    const summary = summarizeHealthResults(results({
      success: false,
      numPassedTests: 12,
      numFailedTests: 1,
    }), false);

    expect(summary.healthy).toBe(false);
    expect(summary.passRate).toBe('92%');
    expect(summary.failedTests).toBe(1);
  });

  it('fails health on a nonzero runner exit even if a malformed report claims success', () => {
    expect(summarizeHealthResults(results(), false).healthy).toBe(false);
  });

  it('fails health when no test actually executed', () => {
    const summary = summarizeHealthResults(results({
      numTotalTests: 90,
      numPassedTests: 0,
      numFailedTests: 0,
    }), true);

    expect(summary.healthy).toBe(false);
    expect(summary.passRate).toBe('0%');
    expect(summary.skippedTests).toBe(90);
  });
});
