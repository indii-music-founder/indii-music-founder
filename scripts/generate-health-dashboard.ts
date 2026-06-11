import fs from 'fs/promises'
import path from 'path'
import { getGitHubCIStatus, getSentryMetrics, getIntegrationTestResults } from './fetch-metrics.js'

/**
 * Generate health dashboard HTML
 * Enhanced to pull real metrics from:
 * - GitHub CI logs (test results, coverage)
 * - Sentry API (error rates, latency)
 * - Integration test results
 * - Firestore health check collection
 */

const generateDashboard = async () => {
  const dashboardPath = path.join(process.cwd(), 'packages/renderer/public/health.html')

  console.log('Fetching metrics...');
  const [ciStatus, sentryMetrics, testResults] = await Promise.all([
    getGitHubCIStatus(),
    getSentryMetrics(),
    getIntegrationTestResults()
  ]);

  const isHealthy = (status: string) => {
    if (['success', '100%'].includes(status) || parseFloat(status) >= 95) return 'healthy';
    if (status === 'Pending' || status === 'N/A' || status.includes('unknown')) return 'warning';
    return 'critical';
  };
  
  const ciClass = isHealthy(ciStatus.passRate);
  const testClass = isHealthy(testResults.passRate);
  
  // Simple check for error rate being low
  const sentryErrorRate = parseFloat(sentryMetrics.errorRate);
  const sentryClass = isNaN(sentryErrorRate) ? 'warning' : (sentryErrorRate < 1 ? 'healthy' : 'critical');

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>INDII Quality Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 20px; background-color: #f9fafb; color: #111827; }
    h1 { border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
    .status { padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .healthy { background: #d1fae5; color: #065f46; border-left: 4px solid #10b981; }
    .warning { background: #fef3c7; color: #92400e; border-left: 4px solid #f59e0b; }
    .critical { background: #fee2e2; color: #991b1b; border-left: 4px solid #ef4444; }
    h3 { margin-top: 0; }
    .metric { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .metric-value { font-weight: 600; }
  </style>
</head>
<body>
  <h1>INDII Quality Dashboard</h1>
  <p>Live system health and quality metrics.</p>
  
  <div class="grid">
    <div class="status ${ciClass}">
      <h3>Build Status</h3>
      <div class="metric"><span>Pass Rate:</span> <span class="metric-value">${ciStatus.passRate}</span></div>
      <div class="metric"><span>Latest Commit:</span> <span class="metric-value">${ciStatus.latestCommit}</span></div>
      <div class="metric"><span>Build Status:</span> <span class="metric-value">${ciStatus.buildStatus}</span></div>
    </div>
    
    <div class="status ${testClass}">
      <h3>Integration Test Health</h3>
      <div class="metric"><span>Pass Rate:</span> <span class="metric-value">${testResults.passRate}</span></div>
      <div class="metric"><span>Total Tests:</span> <span class="metric-value">${testResults.totalTests}</span></div>
      <div class="metric"><span>Avg Latency (p50):</span> <span class="metric-value">${testResults.latencies.p50}ms</span></div>
      <div class="metric"><span>Last Checked:</span> <span class="metric-value">${new Date(testResults.timestamp).toLocaleString()}</span></div>
    </div>

    <div class="status ${sentryClass}">
      <h3>SLA Metrics (Sentry)</h3>
      <div class="metric"><span>Error Rate:</span> <span class="metric-value">${sentryMetrics.errorRate}</span></div>
      <div class="metric"><span>API Latency (p50):</span> <span class="metric-value">${sentryMetrics.apiLatencyP50}</span></div>
      <div class="metric"><span>API Latency (p99):</span> <span class="metric-value">${sentryMetrics.apiLatencyP99}</span></div>
      <div class="metric"><span>Uptime:</span> <span class="metric-value">${sentryMetrics.uptimePercent}</span></div>
    </div>
  </div>
  
  <p style="margin-top: 30px;"><small>Generated on ${new Date().toISOString()}</small></p>
</body>
</html>`

  await fs.mkdir(path.dirname(dashboardPath), { recursive: true })
  await fs.writeFile(dashboardPath, html)

  console.log(`✓ Dashboard generated at ${dashboardPath}`)
}

generateDashboard().catch(err => {
  console.error('Failed to generate dashboard:', err)
  process.exit(1)
})
