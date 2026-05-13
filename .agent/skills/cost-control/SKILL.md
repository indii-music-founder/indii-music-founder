# Cost Control Skill — Universal Workflow for All Agents

**Status:** Production-Ready | **Enforced:** Mandatory before any expensive operation | **Kill-Switch:** $500/month global limit

---

## What This Skill Does

This is the **universal workflow** that prevents runaway agents from incurring unexpected costs. Before ANY expensive operation (video generation, image generation, agent streaming), you MUST:

1. Call `CostControlService.checkAndReserve()`
2. Verify `allowed: true` in the response
3. Proceed only if the check passes
4. Log the `operationId` for audit/tracking

If this is skipped, an agent can accidentally trigger $1000+ charges within minutes.

---

## When to Invoke

**MANDATORY** before:

- **Video generation** (Vertex AI Veo)
  - Cost: $0.10–$0.40 per second (depending on model and resolution)
  - Max per operation: $24 (60 seconds at $0.40/sec)

- **Image generation** (Imagen)
  - Cost: $0.04 per image
  - Max per operation: $2.00 (50 images)

- **Agent streaming** (Gemini API)
  - Cost: $0.001 per request
  - Max per operation: ~$0.10 (100 requests)

- **Long-form content** (multi-segment generation)
  - Chain cost checks for each segment

---

## Implementation Pattern

### Step 1: Calculate Estimated Cost

Before calling the service, estimate the operation cost based on parameters:

```typescript
// Video: estimate based on duration and model
const estimateVideoCost = (durationSeconds: number, model: 'fast' | 'pro'): number => {
  const rates = { fast: 0.10, pro: 0.40 };
  return durationSeconds * rates[model];
};

// Image: estimate based on quantity
const estimateImageCost = (count: number): number => 0.04 * count;

// Agent stream: fixed cost per request
const estimateAgentStreamCost = (): number => 0.001;
```

### Step 2: Call Cost Check

```typescript
import { CostControlService } from '@/services/billing/CostControlService';

const costCheck = await CostControlService.checkAndReserve({
  operationType: 'video',  // 'video' | 'image' | 'agent_stream'
  estimatedCost: estimateVideoCost(8, 'pro'),  // $3.20
  userId: currentUser.uid,
  metadata: {
    prompt: videoPrompt,
    duration: 8,
    model: 'pro',
    resolution: '4k',
  },
});
```

### Step 3: Guard the Expensive Operation

```typescript
if (!costCheck.allowed) {
  // Reject operation. Return early with user feedback.
  throw new Error(`Operation blocked: ${costCheck.reason}`);
  // Or for UI: showToast(`Budget limit: ${costCheck.reason}`);
}

// Safe to proceed with expensive API call
const result = await generateVideoViaVertexAI({
  prompt: videoPrompt,
  durationSeconds: 8,
  model: 'pro',
  resolution: '4k',
});
```

### Step 4: Log the Result

```typescript
logger.info('[Agent] Video generation completed', {
  operationId: costCheck.operationId,
  estimatedCost: costCheck.estimatedCost,
  actualDuration: result.durationSeconds,
  remainingBudget: costCheck.remainingBudget,
});
```

---

## Budget Tiers

| Tier | Daily | Monthly | Hourly | Use Case |
|------|-------|---------|--------|----------|
| **Free** | $5 | $50 | $1.00 | Individual artist, testing |
| **Pro** | $25 | $250 | $5.00 | Active distribution, regular releases |
| **Enterprise** | $100 | $1000 | $20.00 | Label, multi-artist platform |
| **Runaway Kill-Switch** | — | **$500** | — | **GLOBAL HARD LIMIT** |

**Key Point:** Regardless of tier, no single account can exceed $500/month. This is the hard kill-switch.

---

## Cost Control Service API

### `checkAndReserve(req: CostCheckRequest): Promise<CostCheckResponse>`

**Request:**

```typescript
interface CostCheckRequest {
  operationType: 'video' | 'image' | 'agent_stream';
  estimatedCost: number;           // Estimated cost in USD
  userId: string;
  metadata?: Record<string, unknown>;
}
```

**Response:**

```typescript
interface CostCheckResponse {
  allowed: boolean;                // true = operation approved and cost reserved
  reason?: string;                 // Human-readable reason if blocked
  remainingBudget: number;         // Daily budget remaining after reservation
  dailyUsed: number;               // Total spent today (after reservation)
  monthlyUsed: number;             // Total spent this month (after reservation)
  operationId?: string;            // Unique ID for audit tracking
}
```

---

### `getStatus(userId: string): Promise<{ ... }>`

Read-only budget status (no reservation):

```typescript
const status = await CostControlService.getStatus(currentUser.uid);
console.log(`Daily: $${status.dailyUsed}/$${status.dailyRemaining} remaining`);
console.log(`Monthly: $${status.monthlyUsed}/$${status.monthlyRemaining} remaining`);
```

---

## Failure Modes & Recovery

### Scenario 1: Daily Budget Exhausted

**Symptom:** `allowed: false, reason: "Daily budget exceeded..."`

**Recovery:**
- Inform user: "You've hit your daily limit. It resets tomorrow at midnight UTC."
- Suggest: Upgrade to Pro tier for higher limits
- Log the incident for support escalation

```typescript
if (costCheck.reason?.includes('Daily budget')) {
  showUpgradePrompt('Daily limit reached');
}
```

### Scenario 2: Monthly Budget Exhausted

**Symptom:** `allowed: false, reason: "Monthly budget exceeded..."`

**Recovery:**
- Inform user: "You've hit your monthly limit. It resets on the 1st."
- Suggest: Contact support for emergency credit or upgrade
- Log the incident

### Scenario 3: Runaway Kill-Switch Triggered

**Symptom:** `allowed: false, reason: "RUNAWAY_PROTECTION: ... exceeds global limit ($500)"`

**Recovery:**
- **CRITICAL**: This indicates a genuine runaway condition
- Immediately block ALL expensive operations for this user
- Alert support / admin to investigate
- Check Firestore `incidents` collection for details

```typescript
if (costCheck.reason?.includes('RUNAWAY_PROTECTION')) {
  // Lock user out of expensive features
  showAlert('Your account has triggered runaway protection. Contact support.');
  return;
}
```

### Scenario 4: Cost System Unavailable

**Symptom:** `allowed: false, reason: "Cost control system unavailable..."`

**Recovery:**
- The service is in **fail-secure mode** (blocks operations if unavailable)
- Wait and retry in 30 seconds
- If persistent, check Firestore status and consider fallback to safe defaults

```typescript
if (costCheck.reason?.includes('unavailable')) {
  // System is down. Block operation for safety.
  showAlert('Cost control system is unavailable. Please try again in a moment.');
  // Do NOT proceed with the expensive operation
  return;
}
```

---

## Integration Checklist

For each agent/module that triggers expensive operations, ensure:

- [ ] Import `CostControlService` at module entry point
- [ ] Calculate `estimatedCost` before calling expensive APIs
- [ ] Call `checkAndReserve()` and await response
- [ ] Guard expensive operations with `if (!costCheck.allowed) { return; }`
- [ ] Log `operationId` for audit trail
- [ ] Display user-friendly error messages (not raw reason strings)
- [ ] Test with dry runs on low-cost operations first

---

## Testing This Workflow

### Unit Test

```typescript
// Test that checkAndReserve blocks operations over budget
it('should block video generation over daily limit', async () => {
  const costCheck = await CostControlService.checkAndReserve({
    operationType: 'video',
    estimatedCost: 100, // Way over free tier $5 daily limit
    userId: 'test-user',
  });
  expect(costCheck.allowed).toBe(false);
  expect(costCheck.reason).toContain('Daily budget exceeded');
});
```

### Manual Test

1. **Free Tier Test:**
   ```bash
   # As a free user, trigger video generation with $6 estimated cost
   # Should be blocked with "Daily budget exceeded" message
   ```

2. **Pro Tier Test:**
   ```bash
   # As a Pro user, trigger video generation with $20 estimated cost
   # Should be allowed; remaining should be $5 ($25 - $20)
   ```

3. **Runaway Test:**
   ```bash
   # As any user, manually set monthly cost to $490 in Firestore
   # Trigger operation with $20 estimated cost
   # Should be blocked with "RUNAWAY_PROTECTION" message
   ```

---

## Compliance Notes

This workflow satisfies:

- ✅ **GCP Terms of Service 3.3** — Prevents fee circumvention via quota evasion
- ✅ **Firestore Security Rules** — All cost tracking is server-enforced
- ✅ **Audit Logging** — Every operation logged with operationId for compliance
- ✅ **Fail-Secure Design** — Blocks on system errors, never allows on failure
- ✅ **Real-Time Monitoring** — Incidents logged and tracked in real-time

---

## FAQ

**Q: Can an agent bypass the cost check?**

A: No. There are two layers:
1. Client-side `CostControlService.checkAndReserve()` (fast, prevents UX hang)
2. Server-side `enforceOperationCost()` Cloud Function (final kill-switch)

If the client-side check somehow fails, the server function blocks it.

---

**Q: What if I estimate the cost wrong?**

A: The reservation is based on *estimated* cost. If the actual cost is lower, the difference rolls over. If higher, the system logs the discrepancy for auditing. The ledger always reflects the estimated cost at reservation time.

---

**Q: How do I check my remaining budget?**

A: Use `getStatus()`:

```typescript
const status = await CostControlService.getStatus(userId);
console.log(`Daily remaining: $${status.dailyRemaining}`);
console.log(`Monthly remaining: $${status.monthlyRemaining}`);
```

Or display it in the UI with a budget widget.

---

**Q: Can I get an emergency credit override?**

A: That's a business decision outside this workflow. Contact William for manual overrides. Overrides are logged in `incidents` collection with metadata for audit.

---

## References

- **Full System Design:** `docs/COST_CONTROL_SYSTEM.md`
- **Service Implementation:** `packages/renderer/src/services/billing/CostControlService.ts`
- **Server Enforcement:** `packages/firebase/src/functions/billing/enforceOperationCost.ts`
- **Firestore Schema:** `docs/COST_CONTROL_SYSTEM.md` (System Components section)

---

**Last Updated:** 2026-05-13  
**Enforced By:** All agents, all platforms  
**Kill-Switch Active:** Yes ($500/month global limit)
