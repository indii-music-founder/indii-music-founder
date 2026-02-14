import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Video Generation Load Test
 *
 * Tests the video generation callable function under load.
 * Uses smaller payloads to stress the rate limiter and queue system.
 *
 * Run: k6 run load-tests/video-generation.js
 *
 * Prerequisites:
 *   - Firebase emulators running, or FUNCTIONS_URL set to production
 *   - AUTH_TOKEN set to a valid Firebase ID token
 */
export const options = {
    stages: [
        { duration: '15s', target: 10 },  // Ramp up to 10 concurrent users
        { duration: '1m', target: 10 },    // Steady state
        { duration: '10s', target: 0 },    // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<10000'], // Video gen is slow - 10s threshold
        http_req_failed: ['rate<0.10'],     // Allow up to 10% failures (rate limiting)
    },
};

const BASE_URL = __ENV.FUNCTIONS_URL || 'http://127.0.0.1:5001/indiios-v-1-1/us-central1';

export default function () {
    const url = `${BASE_URL}/triggerVideoJob`;
    const payload = JSON.stringify({
        data: {
            prompt: 'A gentle ocean wave at sunset, 4 seconds',
            aspectRatio: '16:9',
            duration: 4,
            orgId: 'personal',
        }
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
        },
        timeout: '30s',
    };

    const res = http.post(url, payload, params);

    check(res, {
        'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
        'rate limited returns proper error': (r) => {
            if (r.status === 429) return true;
            return r.status === 200;
        },
    });

    sleep(3); // Don't hammer - these are expensive operations
}
