import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 50 }, // Ramp up to 50 users
        { duration: '1m', target: 50 },  // Stay at 50 users
        { duration: '10s', target: 0 },  // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s (mocked) or 10s (real)
        http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
    },
};

export default function () {
    const url = 'http://127.0.0.1:5001/indiios-v-1-1/us-central1/creativeDirectorAgent';
    const payload = JSON.stringify({
        prompt: 'Create a futuristic city concept',
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const res = http.post(url, payload, params);

    check(res, {
        'is status 200': (r) => r.status === 200,
        'has result': (r) => r.json('result') !== undefined,
    });

    sleep(1);
}
