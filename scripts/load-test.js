/**
 * Item 284: Load Testing Baseline Script (k6)
 *
 * Tests three critical Cloud Functions endpoints under load:
 *   - generateContent (AI generation — highest cost per call)
 *   - createRelease   (metadata + DDEX — complex write path)
 *   - processPayment  (Stripe → Firestore — latency-sensitive)
 *
 * Targets:
 *   - P95 response time < 3s for AI generation
 *   - P95 response time < 1s for createRelease
 *   - P95 response time < 500ms for processPayment status check
 *   - Error rate < 1% under 100 VUs
 *
 * Run:
 *   k6 run scripts/load-test.js \
 *     -e BASE_URL=https://us-central1-indiios-v-1-1.cloudfunctions.net \
 *     -e AUTH_TOKEN=<firebase_id_token>
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ── Custom Metrics ────────────────────────────────────────────────────────────

const generateContentDuration = new Trend('generate_content_duration', true);
const createReleaseDuration    = new Trend('create_release_duration', true);
const paymentStatusDuration    = new Trend('payment_status_duration', true);
const errorRate                = new Rate('error_rate');
const totalRequests            = new Counter('total_requests');

// ── Load Stages ───────────────────────────────────────────────────────────────

export const options = {
    stages: [
        { duration: '30s', target: 10  },   // warm-up: ramp to 10 VUs
        { duration: '1m',  target: 50  },   // ramp to 50 VUs
        { duration: '2m',  target: 100 },   // sustain 100 VUs (peak load)
        { duration: '30s', target: 0   },   // ramp down
    ],
    thresholds: {
        // Overall HTTP error rate < 1%
        http_req_failed: ['rate<0.01'],
        // AI generation P95 < 3000ms
        'generate_content_duration': ['p(95)<3000'],
        // Release creation P95 < 1000ms
        'create_release_duration': ['p(95)<1000'],
        // Payment status P95 < 500ms
        'payment_status_duration': ['p(95)<500'],
    },
};

// ── Test Data ─────────────────────────────────────────────────────────────────

const BASE_URL     = __ENV.BASE_URL || 'https://us-central1-indiios-v-1-1.cloudfunctions.net';
const AUTH_TOKEN   = __ENV.AUTH_TOKEN || 'test_token_placeholder';

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
};

// ── VU Scenario ───────────────────────────────────────────────────────────────

export default function () {
    group('AI Content Generation', () => {
        const payload = JSON.stringify({
            data: {
                prompt: 'Write a 3-sentence press release for an indie hip-hop EP.',
                type: 'press_release',
                maxTokens: 200,
            },
        });

        const res = http.post(`${BASE_URL}/generateContent`, payload, { headers });
        generateContentDuration.add(res.timings.duration);
        totalRequests.add(1);

        const ok = check(res, {
            'generateContent status 200': (r) => r.status === 200,
            'generateContent has result':  (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return !!body.result;
                } catch {
                    return false;
                }
            },
        });

        errorRate.add(!ok);
    });

    sleep(1);

    group('Release Creation', () => {
        const payload = JSON.stringify({
            data: {
                title: `Load Test Track ${__VU}-${__ITER}`,
                artist: 'Load Test Artist',
                genre: 'Electronic',
                releaseDate: '2025-06-01',
                distributors: ['distrokid'],
            },
        });

        const res = http.post(`${BASE_URL}/createRelease`, payload, { headers });
        createReleaseDuration.add(res.timings.duration);
        totalRequests.add(1);

        const ok = check(res, {
            'createRelease status 200 or 201': (r) => r.status === 200 || r.status === 201,
        });

        errorRate.add(!ok);
    });

    sleep(0.5);

    group('Payment Status Check', () => {
        const payload = JSON.stringify({
            data: { userId: `load-test-user-${__VU}` },
        });

        const res = http.post(`${BASE_URL}/getSubscriptionStatus`, payload, { headers });
        paymentStatusDuration.add(res.timings.duration);
        totalRequests.add(1);

        const ok = check(res, {
            'getSubscriptionStatus status 200': (r) => r.status === 200,
        });

        errorRate.add(!ok);
    });

    sleep(1);
}

// ── Summary Report ────────────────────────────────────────────────────────────

export function handleSummary(data) {
    return {
        'scripts/load-test-results.json': JSON.stringify(data, null, 2),
        stdout: `
====================================================================
indiiOS Load Test Summary (Item 284)
====================================================================
Total Requests:        ${data.metrics.total_requests?.values?.count ?? 'N/A'}
HTTP Error Rate:       ${((data.metrics.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%

generate_content P95:  ${data.metrics.generate_content_duration?.values?.['p(95)']?.toFixed(0) ?? 'N/A'} ms (target: <3000ms)
create_release P95:    ${data.metrics.create_release_duration?.values?.['p(95)']?.toFixed(0) ?? 'N/A'} ms (target: <1000ms)
payment_status P95:    ${data.metrics.payment_status_duration?.values?.['p(95)']?.toFixed(0) ?? 'N/A'} ms (target: <500ms)
====================================================================
`,
    };
}
