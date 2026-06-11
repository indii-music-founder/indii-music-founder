import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

async function runHealthCheck() {
  const tmpFile = join(tmpdir(), `vitest-results-${Date.now()}.json`);
  let passed = false;
  
  try {
    console.log('Running integration tests for health check...');
    
    // Run vitest with json reporter. We catch errors because failing tests exit with non-zero
    // but still output valid JSON.
    await execAsync(`npx vitest run integration.test.ts --reporter=json > "${tmpFile}"`).catch(() => {});
    
    if (!existsSync(tmpFile)) {
      throw new Error(`Failed to generate test results at ${tmpFile}`);
    }

    const resultsJson = readFileSync(tmpFile, 'utf-8');
    
    // Handle cases where stdout has other logs before/after the JSON
    const jsonStartIndex = resultsJson.indexOf('{');
    const jsonEndIndex = resultsJson.lastIndexOf('}');
    
    if (jsonStartIndex === -1 || jsonEndIndex === -1) {
      throw new Error('Could not find valid JSON in test output:\n' + resultsJson);
    }
    
    const cleanJson = resultsJson.substring(jsonStartIndex, jsonEndIndex + 1);
    const results = JSON.parse(cleanJson);
    
    const totalTests = results.numTotalTests || 0;
    const passedTests = results.numPassedTests || 0;
    const passRate = totalTests > 0 ? `${Math.round((passedTests / totalTests) * 100)}%` : '0%';
    
    // Extract latencies
    const durations: number[] = [];
    if (results.testResults) {
      for (const suite of results.testResults) {
        if (suite.assertionResults) {
          for (const assertion of suite.assertionResults) {
            if (typeof assertion.duration === 'number') {
              durations.push(assertion.duration);
            }
          }
        }
      }
    }
    
    durations.sort((a, b) => a - b);
    const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
    const p99 = durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0;
    
    console.log(`Test Pass Rate: ${passRate} (${passedTests}/${totalTests})`);
    console.log(`Latency p50: ${Math.round(p50)}ms, p99: ${Math.round(p99)}ms`);
    
    // Write to Firestore
    if (getApps().length === 0) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          initializeApp({
            credential: cert(serviceAccount)
          });
          console.log('Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT');
        } catch (e) {
          console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT as JSON. Falling back to default initialization.');
          initializeApp();
        }
      } else {
        initializeApp();
      }
    }
    const db = getFirestore();
    
    await db.collection('healthChecks').add({
      timestamp: FieldValue.serverTimestamp(),
      testCount: totalTests,
      testPassRate: passRate,
      latencies: {
        p50: Math.round(p50),
        p99: Math.round(p99)
      }
    });
    
    console.log('Successfully wrote health check results to Firestore.');
    passed = true;
  } catch (error) {
    console.error('Failed to run health check:', error);
  } finally {
    try {
      if (existsSync(tmpFile)) {
        unlinkSync(tmpFile);
      }
    } catch (e) {
      // ignore
    }
  }
  
  if (!passed) {
    process.exit(1);
  }
}

runHealthCheck();
