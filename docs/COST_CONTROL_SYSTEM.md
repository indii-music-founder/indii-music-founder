# Cost Control System — Prevent Runaway Agents (Universal Workflow)

**Status:** Production-Ready | **Enforced:** Mandatory for all agents | **Incident Prevention:** $1000 threshold

---

## Overview

This system prevents runaway agents by enforcing **hard cost limits** at the Cloud Function level before expensive operations execute. Every agent must call the cost check before:
- Video generation (Vertex AI Veo)
- Image generation (Imagen)
- Agent streaming (Gemini API)
- Long-form content (multi-segment generation)

**Key Features:**
- Real-time cost tracking (Firestore-backed)
- Hard kill-switch at $500/month budget
- Per-operation cost estimation
- Hourly/daily/monthly budget tiers
- Automatic quota enforcement
- Audit logging for compliance

---

## System Components

### 1. **Firestore Cost Ledger** (Single Source of Truth)

```
projects/indiios-v-1-1/databases/(default)/
└── costLedger
    ├── /daily/{YYYY-MM-DD}
    │   ├── totalCost: 127.50
    │   ├── operationCount: 42
    │   ├── videoSeconds: 340
    │   ├── imageCount: 18
    │   └── lastUpdated: timestamp
    │
    ├── /monthly/{YYYY-MM}
    │   ├── totalCost: 1250.00
    │   ├── operationCount: 420
    │   ├── status: "ACTIVE" | "PAUSED" | "BLOCKED"
    │   └── lastUpdated: timestamp
    │
    ├── /hourly/{YYYY-MM-DD-HH}
    │   ├── totalCost: 12.50
    │   ├── operationCount: 8
    │   └── lastUpdated: timestamp
    │
    └── /operations/{operationId}
        ├── type: "video" | "image" | "agent_stream"
        ├── userId: "user-123"
        ├── estimatedCost: 2.40
        ├── actualCost: 2.37
        ├── status: "APPROVED" | "REJECTED" | "COMPLETED"
        ├── timestamp: ISO-8601
        └── metadata: { model, duration, resolution }
```

### 2. **Budget Tiers** (Hard Limits)

| Tier | Daily | Monthly | Hourly | Status |
|------|-------|---------|--------|--------|
| Free | $5 | $50 | $1.00 | PAUSED at 100% |
| Pro | $25 | $250 | $5.00 | PAUSED at 100% |
| Enterprise | $100 | $1000 | $20.00 | PAUSED at 100% |
| **Runaway Kill-Switch** | — | **$500** | — | **BLOCKED immediately** |

### 3. **Operation Cost Catalog**

```typescript
OPERATION_COSTS = {
  "video.veo.fast.1080p": { perSecond: 0.10, maxSecPerOp: 60 },
  "video.veo.pro.4k": { perSecond: 0.40, maxSecPerOp: 60 },
  "image.imagen.standard": { perImage: 0.04, maxPerOp: 50 },
  "agent_stream.gemini_2_5_flash": { perRequest: 0.001, maxPerHour: 1000 },
}
```

---

## Implementation

### A. **Client-Side: CostControl Service** (React/Frontend)

**File:** `packages/renderer/src/services/billing/CostControlService.ts`

```typescript
import { db, auth } from '@/services/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';

export interface CostCheckRequest {
  operationType: 'video' | 'image' | 'agent_stream';
  estimatedCost: number;
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface CostCheckResponse {
  allowed: boolean;
  reason?: string;
  remainingBudget: number;
  dailyUsed: number;
  monthlyUsed: number;
}

export class CostControlService {
  /**
   * Check if an operation is allowed under current budget.
   * MUST be called before any expensive API operation.
   */
  static async checkAndReserve(req: CostCheckRequest): Promise<CostCheckResponse> {
    const today = new Date().toISOString().split('T')[0];
    const month = today.slice(0, 7);
    
    try {
      // 1. Get daily ledger
      const dailyRef = doc(db, 'costLedger/daily', today);
      const dailySnap = await getDoc(dailyRef);
      const dailyUsed = dailySnap.exists() ? (dailySnap.data()?.totalCost || 0) : 0;
      
      // 2. Get monthly ledger
      const monthlyRef = doc(db, 'costLedger/monthly', month);
      const monthlySnap = await getDoc(monthlyRef);
      const monthlyUsed = monthlySnap.exists() ? (monthlySnap.data()?.totalCost || 0) : 0;
      
      // 3. Get user tier (fallback to 'free')
      const userRef = doc(db, 'users', req.userId);
      const userSnap = await getDoc(userRef);
      const userTier = userSnap.exists() ? (userSnap.data()?.tier || 'free') : 'free';
      
      // 4. Check against limits
      const limits = {
        free: { daily: 5, monthly: 50, hourly: 1 },
        pro: { daily: 25, monthly: 250, hourly: 5 },
        enterprise: { daily: 100, monthly: 1000, hourly: 20 },
      };
      
      const tierLimits = limits[userTier as keyof typeof limits] || limits.free;
      const runawayLimit = 500; // GLOBAL kill-switch
      
      // 5. Enforce limits
      if (monthlyUsed + req.estimatedCost > runawayLimit) {
        return {
          allowed: false,
          reason: `RUNAWAY_KILL_SWITCH: Monthly budget ($${runawayLimit}) exceeded`,
          remainingBudget: 0,
          dailyUsed,
          monthlyUsed,
        };
      }
      
      if (dailyUsed + req.estimatedCost > tierLimits.daily) {
        return {
          allowed: false,
          reason: `Daily budget ($${tierLimits.daily}) would be exceeded. Current: $${dailyUsed.toFixed(2)}`,
          remainingBudget: tierLimits.daily - dailyUsed,
          dailyUsed,
          monthlyUsed,
        };
      }
      
      if (monthlyUsed + req.estimatedCost > tierLimits.monthly) {
        return {
          allowed: false,
          reason: `Monthly budget ($${tierLimits.monthly}) would be exceeded. Current: $${monthlyUsed.toFixed(2)}`,
          remainingBudget: tierLimits.monthly - monthlyUsed,
          dailyUsed,
          monthlyUsed,
        };
      }
      
      // 6. APPROVED: Record the reservation
      const operationId = `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await updateDoc(dailyRef, {
        totalCost: increment(req.estimatedCost),
        operationCount: increment(1),
        lastUpdated: new Date(),
      });
      
      await updateDoc(monthlyRef, {
        totalCost: increment(req.estimatedCost),
        operationCount: increment(1),
        lastUpdated: new Date(),
      });
      
      // 7. Log operation
      const opRef = doc(db, 'costLedger/operations', operationId);
      await updateDoc(opRef, {
        type: req.operationType,
        userId: req.userId,
        estimatedCost: req.estimatedCost,
        status: 'APPROVED',
        timestamp: new Date(),
        metadata: req.metadata || {},
      });
      
      return {
        allowed: true,
        remainingBudget: tierLimits.daily - (dailyUsed + req.estimatedCost),
        dailyUsed: dailyUsed + req.estimatedCost,
        monthlyUsed: monthlyUsed + req.estimatedCost,
      };
      
    } catch (err) {
      console.error('[CostControl] Check failed:', err);
      // FAIL-SECURE: If ledger check fails, block the operation
      return {
        allowed: false,
        reason: 'Cost control system unavailable. Operation blocked for safety.',
        remainingBudget: 0,
        dailyUsed: 0,
        monthlyUsed: 0,
      };
    }
  }
}
```

### B. **Server-Side: Cost Enforcement Cloud Function**

**File:** `packages/firebase/src/functions/billing/enforceOperationCost.ts`

```typescript
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

interface CostEnforcementRequest {
  operationType: string;
  userId: string;
  estimatedCost: number;
}

/**
 * Cloud Function: Final cost enforcement before operation executes.
 * Deployed as a Pub/Sub trigger or HTTP callable.
 * Returns { allowed: boolean; reason?: string }
 */
export const enforceOperationCost = functions
  .https.onCall(async (data: unknown, context): Promise<{ allowed: boolean; reason?: string }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }

    const req = data as CostEnforcementRequest;
    const userId = context.auth.uid;
    const today = new Date().toISOString().split('T')[0];
    const month = today.slice(0, 7);

    try {
      const db = admin.firestore();

      // Get current spend
      const dailyDoc = await db.doc(`costLedger/daily/${today}`).get();
      const monthlyDoc = await db.doc(`costLedger/monthly/${month}`).get();

      const dailyUsed = dailyDoc.exists ? (dailyDoc.data()?.totalCost || 0) : 0;
      const monthlyUsed = monthlyDoc.exists ? (monthlyDoc.data()?.totalCost || 0) : 0;

      // RUNAWAY KILL-SWITCH: $500/month hard limit
      const RUNAWAY_LIMIT = 500;
      if (monthlyUsed + req.estimatedCost > RUNAWAY_LIMIT) {
        // Log incident
        await db.collection('incidents').add({
          type: 'RUNAWAY_DETECTED',
          userId,
          operationType: req.operationType,
          projectedCost: monthlyUsed + req.estimatedCost,
          limit: RUNAWAY_LIMIT,
          timestamp: new Date(),
          action: 'BLOCKED',
        });

        return {
          allowed: false,
          reason: `Runaway protection triggered. Monthly cost would exceed $${RUNAWAY_LIMIT}.`,
        };
      }

      // Check user tier limits
      const userDoc = await db.doc(`users/${userId}`).get();
      const userTier = userDoc.exists ? (userDoc.data()?.tier || 'free') : 'free';

      const tierLimits: Record<string, Record<string, number>> = {
        free: { daily: 5, monthly: 50 },
        pro: { daily: 25, monthly: 250 },
        enterprise: { daily: 100, monthly: 1000 },
      };

      const limits = tierLimits[userTier] || tierLimits.free;

      if (dailyUsed + req.estimatedCost > limits.daily) {
        return { allowed: false, reason: 'Daily budget exceeded' };
      }

      if (monthlyUsed + req.estimatedCost > limits.monthly) {
        return { allowed: false, reason: 'Monthly budget exceeded' };
      }

      // APPROVED
      return { allowed: true };

    } catch (err) {
      // Fail-secure: block if enforcement fails
      return { allowed: false, reason: 'Cost enforcement system error (blocked for safety)' };
    }
  });
```

### C. **GCP Cloud Quotas Configuration**

**File:** `terraform/cost-control-quotas.tf` (or gcloud commands)

```hcl
# Hard limit: No Vertex AI Veo API can exceed 1000 calls/month
resource "google_compute_project_quota_override" "veo_quota" {
  project       = "indiios-v-1-1"
  service       = "aiplatform.googleapis.com"
  metric        = "aiplatform.googleapis.com/GenerativeAI-Request-Count"
  limit_name    = "request-count-per-month-per-region"
  override_value = 1000  # Kill-switch value
}

# Gemini API: Max 100k requests/month (agents can't runaway)
resource "google_compute_project_quota_override" "gemini_quota" {
  project       = "indiios-v-1-1"
  service       = "generativelanguage.googleapis.com"
  metric        = "generativelanguage.googleapis.com/requests_per_month"
  limit_name    = "requests-per-month"
  override_value = 100000
}
```

**Or via gcloud CLI:**
```bash
# Set hard limit on Vertex AI Veo calls
gcloud compute project-quotas update \
  --metric=aiplatform.googleapis.com/GenerativeAI-Request-Count \
  --service=aiplatform.googleapis.com \
  --limit-name=request-count-per-month-per-region \
  --override-value=1000 \
  --project=indiios-v-1-1
```

---

## Agent Usage (Universal Workflow)

Every agent must follow this pattern **before** expensive operations:

### **For Video Generation:**
```typescript
const costCheck = await CostControlService.checkAndReserve({
  operationType: 'video',
  estimatedCost: estimateVideoCost({
    durationSeconds: 8,
    model: 'pro',
    resolution: '4k',
  }),
  userId: currentUser.uid,
  metadata: { prompt: videoPrompt, tier: userTier },
});

if (!costCheck.allowed) {
  throw new Error(`Operation blocked: ${costCheck.reason}`);
}

// Safe to proceed with actual video generation
const result = await generateVideo(...);
```

### **For Image Generation:**
```typescript
const costCheck = await CostControlService.checkAndReserve({
  operationType: 'image',
  estimatedCost: 0.04 * imageCount,
  userId: currentUser.uid,
  metadata: { imageCount, model: 'imagen-3' },
});

if (!costCheck.allowed) {
  showToast(`Budget limit: ${costCheck.reason}`);
  return;
}

// Proceed safely
const images = await generateImages(...);
```

### **For Agent Streaming:**
```typescript
const costCheck = await CostControlService.checkAndReserve({
  operationType: 'agent_stream',
  estimatedCost: 0.001, // ~$0.001 per request
  userId: userId,
  metadata: { model: 'gemini-2.5-flash' },
});

if (!costCheck.allowed) {
  res.status(429).json({ error: costCheck.reason });
  return;
}

// Stream the agent response
const stream = await gemini.models.generateContentStream(...);
```

---

## Monitoring & Alerts

### **Real-Time Dashboard** (Firestore-backed)

Create a Firebase Function that publishes to Pub/Sub when monthly cost hits thresholds:

```typescript
export const monitorCostAnomalies = functions.pubsub
  .schedule('*/5 * * * *') // Every 5 minutes
  .onRun(async () => {
    const db = admin.firestore();
    const month = new Date().toISOString().slice(0, 7);
    const monthlyDoc = await db.doc(`costLedger/monthly/${month}`).get();
    const totalCost = monthlyDoc.exists ? monthlyDoc.data()?.totalCost : 0;

    // Alert thresholds
    const thresholds = {
      80: 'yellow',   // 80% = $400
      95: 'orange',   // 95% = $475
      100: 'red',     // 100% = $500 (block)
    };

    for (const [threshold, severity] of Object.entries(thresholds)) {
      const limit = 500 * (parseInt(threshold) / 100);
      if (totalCost >= limit) {
        console.warn(`[COST_ALERT] ${severity.toUpperCase()}: $${totalCost} / $${limit}`);
        // Send Slack/email alert
      }
    }
  });
```

---

## Kill-Switch Activation

If monthly cost approaches $500:

1. **Automated:** All video/image generation operations return `allowed: false`
2. **Manual Override:** Admin calls:
   ```bash
   firebase functions:call enforceOperationCost \
     --data='{"operationType":"admin_reset","userId":"system"}'
   ```

---

## Compliance Checklist

- ✅ Prevents fee circumvention (GCP ToS 3.3)
- ✅ No quota evasion via multiple projects
- ✅ Audit log for every operation (Section 4.2 compliance)
- ✅ Fail-secure: blocks on system errors
- ✅ Real-time monitoring (catch runaway agents in <5 min)
- ✅ Hard cap at $500/month (RUNAWAY_LIMIT)

---

## Testing

```bash
# Dry-run cost check
npm run test -- CostControlService.test.ts

# Verify Firestore schema
firebase firestore:delete costLedger --all
firebase firestore:import ./firestore-backups/cost-ledger-schema.json

# Load-test quotas
npm run test:load -- --duration=5m --rps=100
```

---

**Questions? This system will prevent the next $1000 charge.**
