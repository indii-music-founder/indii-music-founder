# Load Tests

This directory contains load testing scripts using [k6](https://k6.io/).

## Prerequisites

1. **Install k6:**
    * **Mac:** `brew install k6`
    * **Windows:** `winget install k6`
    * **Linux:** `sudo apt-key adv ...` (see k6 docs)

2. **Start the Application:**
    Ensure the Firebase Emulators are running.

    ```bash
    npm run dev
    ```

    (Note: Ensure `firebase emulators:start` is running if not included in `npm run dev`. Check `package.json` scripts.)

## Running Tests

### Agent Service Load Test

Simulates 50 concurrent users hitting the `creativeDirectorAgent` endpoint.

```bash
k6 run load-tests/agent-service.js
```

## Scenarios

* **Ramp Up:** 30s to 50 VUs
* **Steady State:** 1m at 50 VUs
* **Ramp Down:** 10s to 0 VUs

## Thresholds

* **Latency:** 95% of requests < 2s
* **Error Rate:** < 1%
