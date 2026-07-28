import { exec } from 'child_process';
import { promisify } from 'util';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const execAsync = promisify(exec);

export async function getGitHubCIStatus() {
  try {
    // Attempt to fetch GitHub Actions runs using the gh CLI.
    // If the CLI is authenticated, it will return the latest run status.
    const { stdout } = await execAsync('gh run list --limit 1 --json status,conclusion,headSha');
    const runs = JSON.parse(stdout);
    if (runs.length > 0) {
      const run = runs[0];
      return {
        passRate: run.conclusion === 'success' ? '100%' : '0%',
        latestCommit: run.headSha.substring(0, 7),
        buildStatus: run.conclusion || run.status,
      };
    }
    return { passRate: 'N/A', latestCommit: 'N/A', buildStatus: 'unknown' };
  } catch (error) {
    console.warn('[Metrics] Failed to fetch GitHub CI status. Ensure `gh` CLI is installed and authenticated.', error instanceof Error ? error.message : String(error));
    return { passRate: 'Pending', latestCommit: 'Unknown', buildStatus: 'Unknown' };
  }
}

export async function getSentryMetrics() {
  const token = process.env.SENTRY_TOKEN;

  if (!token) {
    console.warn('[Metrics] SENTRY_TOKEN is not set. Sentry metrics are unavailable.');
    return { errorRate: 'N/A', apiLatencyP50: 'N/A', apiLatencyP99: 'N/A', uptimePercent: 'N/A' };
  }

  console.warn('[Metrics] Sentry metrics collection is not implemented. Metrics are unavailable.');
  return { errorRate: 'N/A', apiLatencyP50: 'N/A', apiLatencyP99: 'N/A', uptimePercent: 'N/A' };
}

export async function getIntegrationTestResults() {
  try {
    if (getApps().length === 0) {
      initializeApp();
    }
    const db = getFirestore();
    const snapshot = await db.collection('healthChecks').orderBy('timestamp', 'desc').limit(1).get();
    
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      return {
        passRate: data.testPassRate ?? 'Unavailable',
        totalTests: data.testCount || 0,
        latencies: data.latencies || { p50: 'N/A', p99: 'N/A' },
        timestamp: data.timestamp?.toDate() || new Date(),
      };
    }
    
    return { 
      passRate: 'No data', 
      totalTests: 0, 
      latencies: { p50: 'N/A', p99: 'N/A' },
      timestamp: new Date()
    };
  } catch (error) {
    console.warn('[Metrics] Failed to fetch integration test results from Firestore.', error instanceof Error ? error.message : String(error));
    return {
      passRate: 'Unavailable',
      totalTests: 0,
      latencies: { p50: 'N/A', p99: 'N/A' },
      timestamp: new Date()
    };
  }
}
