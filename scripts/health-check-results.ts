interface VitestAssertionResult {
  duration?: unknown;
}

interface VitestSuiteResult {
  assertionResults?: VitestAssertionResult[];
}

export interface VitestHealthResults {
  success?: unknown;
  numTotalTests?: unknown;
  numPassedTests?: unknown;
  numFailedTests?: unknown;
  testResults?: VitestSuiteResult[];
}

export interface HealthSummary {
  healthy: boolean;
  discoveredTests: number;
  executedTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  passRate: string;
  p50: number;
  p99: number;
}

function nonnegativeCount(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

export function summarizeHealthResults(
  results: VitestHealthResults,
  runnerSucceeded: boolean,
): HealthSummary {
  const discoveredTests = nonnegativeCount(results.numTotalTests);
  const passedTests = nonnegativeCount(results.numPassedTests);
  const failedTests = nonnegativeCount(results.numFailedTests);
  const executedTests = passedTests + failedTests;
  const skippedTests = Math.max(0, discoveredTests - executedTests);
  const passRate = executedTests > 0
    ? `${Math.round((passedTests / executedTests) * 100)}%`
    : '0%';

  const durations = (results.testResults ?? [])
    .flatMap(suite => suite.assertionResults ?? [])
    .map(assertion => assertion.duration)
    .filter((duration): duration is number =>
      typeof duration === 'number' && Number.isFinite(duration) && duration >= 0
    )
    .sort((a, b) => a - b);
  const p50 = durations.length > 0
    ? durations[Math.floor(durations.length * 0.5)]
    : 0;
  const p99 = durations.length > 0
    ? durations[Math.floor(durations.length * 0.99)]
    : 0;

  return {
    healthy:
      runnerSucceeded
      && results.success === true
      && executedTests > 0
      && failedTests === 0,
    discoveredTests,
    executedTests,
    passedTests,
    failedTests,
    skippedTests,
    passRate,
    p50: Math.round(p50),
    p99: Math.round(p99),
  };
}
