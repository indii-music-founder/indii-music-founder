# Testing Budget Limits — Prevent Expensive Test Runs

**Policy:** Testing should never cost more than $5/day total. If a test exceeds this, it's too expensive to run repeatedly.

---

## The Rule

When testing AI agents or generation features:
- **Maximum per-test budget:** $0.50–$1.00 per test operation
- **Maximum daily budget:** $5.00 for all testing combined
- **Consequence:** Test operations exceeding the daily limit are blocked

This prevents a repeat of the May 2026 incident where agent testing ran up a $1000+ bill.

---

## How Testing Budget Works

### Marking Operations as Tests

When you're testing, flag the operation as a test in two ways:

**Option 1: Metadata flag**
```typescript
const costCheck = await CostControlService.checkAndReserve({
  operationType: 'video',
  estimatedCost: 0.40, // 1 second at pro model = $0.40
  userId: auth.currentUser?.uid || 'test-user',
  metadata: {
    isTest: true,  // ← Flag this as a test operation
    testName: 'agent-video-generation-e2e',
    durationSeconds: 1,
  },
});
```

**Option 2: Environment variable** (for CI/test suites)
```bash
VITE_TEST_MODE=true npm test
```

### Budget Tracking

- **Test operations** are tracked separately in `costLedger/test-{YYYY-MM-DD}`
- **Production operations** are tracked in `costLedger/daily-{YYYY-MM-DD}` and user budgets
- Test spending does NOT count against user tier limits

### What Happens When You Hit the Limit

If you try to run a test that would exceed $5/day:

```
"Testing budget exceeded ($5/day). Used: $4.20, requested: $0.50.
Testing should never cost more than a few dollars."
```

This blocks the test. Options:
1. Wait until tomorrow (test ledger resets daily)
2. Reduce test scope (smaller image, shorter video, fewer API calls)
3. Use a cheaper model or configuration

---

## Cost Estimates for Testing

Plan your tests to stay under $5/day:

### Video Generation
| Duration | Fast Model | Pro Model | Daily Tests (5 max) |
|----------|-----------|-----------|-----|
| 1 sec    | $0.10     | $0.40     | 50 fast or 12 pro |
| 3 sec    | $0.30     | $1.20     | 16 fast or 4 pro |
| 8 sec    | $0.80     | $3.20     | 6 fast or 1 pro |

**Recommendation:** For CI tests, use 1-second videos with the fast model ($0.10 each).

### Image Generation
| Count | Cost/Image | Cost Total | Daily Tests (5 max) |
|-------|-----------|-----------|-----|
| 1     | $0.04     | $0.04     | 125 images |
| 3     | $0.04     | $0.12     | 41 sets of 3 |
| 5     | $0.04     | $0.20     | 25 sets of 5 |

**Recommendation:** For CI tests, generate 1 image per test ($0.04 each).

### Agent Streaming
| Per Request | Daily Tests (5 max) |
|-----------|-----|
| $0.001    | 5000 requests |

**Recommendation:** No limit here—agent streaming is cheap enough for unlimited testing.

---

## Testing Best Practices

### 1. Use the Cheapest Option
```typescript
// GOOD: Use fast model for tests
const result = await videoService.generateVideo({
  model: 'fast',      // $0.10/sec instead of $0.40/sec
  durationSeconds: 1, // Minimum viable duration
  ...
});

// BAD: Using expensive model for tests
const result = await videoService.generateVideo({
  model: 'pro',       // $0.40/sec — overkill for tests
  durationSeconds: 8, // Unnecessarily long
  ...
});
```

### 2. Test Once, Assert Multiple Times
```typescript
// GOOD: One test operation, multiple assertions
const result = await generateVideo({ ... });
expect(result.url).toBeDefined();
expect(result.duration).toBe(1);
expect(result.quality).toBeGreaterThan(0);

// BAD: Multiple test operations
await generateVideo({ ... });
await generateVideo({ ... });
await generateVideo({ ... });
// Cost: 3x the first approach
```

### 3. Mock When Possible
```typescript
// GOOD: Mock expensive operations for unit tests
vi.mock('@/services/video/VideoGenerationService', () => ({
  VideoGenerationService: {
    generateVideo: vi.fn().mockResolvedValue({
      url: 'data:image/png;base64,...',
      duration: 1,
    }),
  },
}));

// Use mocks in 90% of tests, real API calls in 10% (E2E)
```

### 4. E2E Tests Run in Isolation
```bash
# Only run expensive E2E tests in CI on main branch
npm run test:e2e -- --if-branch main

# Developers run cheaper unit tests locally
npm test
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      
      # Unit tests (no cost)
      - run: npm test -- --run
      
      # E2E tests (cost: ~$0.50–1.00)
      - if: github.ref == 'refs/heads/main'
        run: VITE_TEST_MODE=true npm run test:e2e
```

This way:
- **Feature branches:** Only cheap unit tests (mocked)
- **Main branch:** Expensive E2E tests with cost tracking

---

## Monitoring Test Spending

### Daily Checklist

Every morning, check:
```bash
# View today's test spending
firebase firestore:get costLedger/test-$(date +%Y-%m-%d)
```

If it's approaching $5, consider:
1. Pausing expensive E2E tests until tomorrow
2. Reducing test scope
3. Mocking more aggressively

### Weekly Report

Add to your retro:
- Total test spending (should be <$20/week)
- Highest-cost test operations (candidates for mocking)
- Any tests that hit the budget limit

---

## What Counts as "Testing"

**Test operations (subject to $5/day limit):**
- Automated test suites (Vitest, Playwright)
- Local development/debugging (if VITE_TEST_MODE=true)
- Manual QA/staging validations
- Agent capability verification

**NOT test operations (counted against user budgets):**
- Production feature use
- Customer-facing workflows
- Real user interactions

---

## Exceptions & Overrides

**If you genuinely need to exceed $5/day for a test:**

1. Document why in the test
2. Add a comment explaining the business case
3. Notify William before running
4. Plan to reduce cost after the test passes

**Example:**
```typescript
// EXPENSIVE TEST: Demonstrating multi-second video generation
// Cost: $3.20 per run (8 seconds, pro model)
// Justification: Load testing for new video pipeline
// TODO: Replace with mock after pipeline is proven
it('should handle 8-second pro videos without degradation', async () => {
  const result = await videoService.generateVideo({
    model: 'pro',
    durationSeconds: 8,
    metadata: { isTest: true },
  });
  expect(result).toBeDefined();
});
```

---

## Troubleshooting

### "Testing budget exceeded"

**Problem:** Your test was blocked for exceeding $5/day.

**Solution:**
1. Check what you tested today: `firebase firestore:get costLedger/test-$(date +%Y-%m-%d)`
2. Reduce scope (1-sec video instead of 8-sec, 1 image instead of 5, etc.)
3. Wait until midnight UTC (test ledger resets daily)
4. Or mark the operation as non-test if it's truly production

### "Why is my test so expensive?"

**Common causes:**
- Video with pro model (use fast instead)
- Long video duration (use 1 sec for tests)
- Generating multiple images (generate 1, assert multiple times)
- Not flagging as test (add `isTest: true` to metadata)

**Fix:**
```typescript
// Before: $3.20 per run
const result = await generateVideo({ model: 'pro', durationSeconds: 8 });

// After: $0.10 per run (32x cheaper)
const result = await generateVideo({ model: 'fast', durationSeconds: 1 });
```

---

## Summary

| Rule | Cost |
|------|------|
| Max test operation | $1.00 each |
| Max daily test budget | $5.00 |
| Flagging as test | Set `metadata.isTest = true` |
| Separate tracking | Yes (`costLedger/test-{date}`) |
| Resets | Daily at midnight UTC |

**Golden Rule:** If a test costs more than $0.50, consider if it's really necessary to run it repeatedly. Mock it instead.

---

**Document Status:** ACTIVE  
**Last Updated:** 2026-05-13  
**Owner:** William Roberts  
**Next Review:** 2026-06-01
