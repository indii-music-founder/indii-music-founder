# Load Tests

Performance and stress testing scripts using [k6](https://k6.io/).

## Prerequisites

1. **Install k6:**
   - **Mac:** `brew install k6`
   - **Windows:** `winget install k6`
   - **Linux:** See [k6 installation docs](https://grafana.com/docs/k6/latest/set-up/install-k6/)

2. **Start the application:**
   ```bash
   firebase emulators:start   # For local testing
   npm run dev                # Vite dev server
   ```

## Available Tests

### Health Check (`health-check.js`)
Validates health endpoint handles sustained traffic within latency thresholds.

```bash
k6 run load-tests/health-check.js

# Against production:
k6 run -e FUNCTIONS_URL=https://us-central1-indiios-v-1-1.cloudfunctions.net load-tests/health-check.js
```

- **Load:** 100 concurrent users
- **Duration:** 50 seconds total
- **Thresholds:** p95 < 500ms, <1% error rate

### Agent Service (`agent-service.js`)
Simulates concurrent users hitting the creative director agent.

```bash
k6 run load-tests/agent-service.js
```

- **Load:** 50 concurrent users
- **Duration:** ~100 seconds total
- **Thresholds:** p95 < 2s, <1% error rate

### Video Generation (`video-generation.js`)
Stress tests the video generation pipeline and rate limiter.

```bash
k6 run -e AUTH_TOKEN=<firebase-id-token> load-tests/video-generation.js
```

- **Load:** 10 concurrent users (conservative - expensive operations)
- **Duration:** ~85 seconds total
- **Thresholds:** p95 < 10s, <10% error rate (rate limiting expected)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FUNCTIONS_URL` | Cloud Functions base URL | Local emulator |
| `AUTH_TOKEN` | Firebase ID token for authenticated endpoints | `test-token` |

## Interpreting Results

k6 outputs:
- **http_req_duration:** Response time percentiles (p50, p90, p95, p99)
- **http_req_failed:** Error rate
- **iterations:** Total requests completed
- **vus:** Virtual users (concurrent connections)

### Acceptable Thresholds

| Endpoint | p95 Target | Max Error Rate |
|----------|-----------|----------------|
| Health Check | < 500ms | < 1% |
| Agent Service | < 2s | < 1% |
| Video Generation | < 10s | < 10% |
