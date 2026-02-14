import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Health Check Load Test
 *
 * Validates that the health endpoint can handle sustained traffic
 * and responds within acceptable latency thresholds.
 *
 * Run: k6 run load-tests/health-check.js
 */
export const options = {
    stages: [
        { duration: '10s', target: 100 }, // Ramp up to 100 concurrent users
        { duration: '30s', target: 100 }, // Steady state
        { duration: '10s', target: 0 },   // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],  // 95th percentile < 500ms
        http_req_failed: ['rate<0.01'],    // <1% error rate
    },
};

const BASE_URL = __ENV.FUNCTIONS_URL || 'https://us-central1-indiios-v-1-1.cloudfunctions.net';

export default function () {
    const res = http.get(`${BASE_URL}/healthCheck`);

    check(res, {
        'status is 200 or 503': (r) => r.status === 200 || r.status === 503,
        'has status field': (r) => {
            try { return JSON.parse(r.body).status !== undefined; } catch { return false; }
        },
        'response time < 1s': (r) => r.timings.duration < 1000,
    });

    sleep(0.5);
}
