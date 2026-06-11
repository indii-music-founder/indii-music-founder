# Cost Control Integration Guide — For All Agents

This document provides copy-paste patterns for integrating cost control into your agent workflows. Use these patterns for video generation, image generation, and agent streaming.

---

## Pattern 1: Video Generation (Vertex AI Veo)

### Step 1: Calculate Cost

```typescript
const estimateVideoCost = (params: {
  durationSeconds: number;
  model: 'fast' | 'pro';
  resolution: '1080p' | '4k';
}): number => {
  // Pricing from Vertex AI Veo
  const baseRate = params.model === 'fast' ? 0.10 : 0.40;
  return params.durationSeconds * baseRate;
};

// Example: 8-second 4K video with pro model
const estimatedCost = estimateVideoCost({
  durationSeconds: 8,
  model: 'pro',
  resolution: '4k',
}); // $3.20
```

### Step 2: Check Cost Before Generation

```typescript
import { CostControlService } from '@/services/billing/CostControlService';

const costCheck = await CostControlService.checkAndReserve({
  operationType: 'video',
  estimatedCost,
  userId: currentUser.uid,
  metadata: {
    prompt: videoPrompt,
    durationSeconds: 8,
    model: 'pro',
    resolution: '4k',
    tier: userTier,
  },
});

if (!costCheck.allowed) {
  throw new Error(`Video generation blocked: ${costCheck.reason}`);
}
```

### Step 3: Generate Video (Safe to Proceed)

```typescript
try {
  const videoResult = await vertexAIVeoService.generateVideo({
    prompt: videoPrompt,
    durationSeconds: 8,
    model: 'pro',
    resolution: '4k',
  });

  logger.info('[Agent] Video generation succeeded', {
    operationId: costCheck.operationId,
    duration: videoResult.durationSeconds,
    url: videoResult.url,
    cost: costCheck.estimatedCost,
    remainingBudget: costCheck.remainingBudget,
  });

  return videoResult;
} catch (err) {
  logger.error('[Agent] Video generation failed', {
    operationId: costCheck.operationId,
    error: err.message,
  });
  throw err;
}
```

---

## Pattern 2: Image Generation (Imagen)

### Step 1: Calculate Cost

```typescript
const estimateImageCost = (imageCount: number): number => {
  // Imagen pricing: $0.04 per image
  return imageCount * 0.04;
};

// Example: Generate 5 album cover variations
const estimatedCost = estimateImageCost(5); // $0.20
```

### Step 2: Check Cost Before Generation

```typescript
const costCheck = await CostControlService.checkAndReserve({
  operationType: 'image',
  estimatedCost,
  userId: currentUser.uid,
  metadata: {
    imageCount: 5,
    prompt: albumCoverPrompt,
    model: 'imagen-3',
    purpose: 'album_cover_variations',
  },
});

if (!costCheck.allowed) {
  showToast(`Image generation blocked: ${costCheck.reason}`);
  return null;
}
```

### Step 3: Generate Images (Safe to Proceed)

```typescript
try {
  const images = await imagenService.generateImages({
    prompt: albumCoverPrompt,
    count: 5,
    model: 'imagen-3',
  });

  logger.info('[Agent] Image generation succeeded', {
    operationId: costCheck.operationId,
    imageCount: images.length,
    cost: costCheck.estimatedCost,
    remainingBudget: costCheck.remainingBudget,
  });

  return images;
} catch (err) {
  logger.error('[Agent] Image generation failed', {
    operationId: costCheck.operationId,
    error: err.message,
  });
  throw err;
}
```

---

## Pattern 3: Agent Streaming (Gemini API)

### Step 1: Calculate Cost (Fixed Per Request)

```typescript
const estimateAgentStreamCost = (): number => {
  // Gemini API streaming: $0.001 per request
  // Adjust if using different models
  return 0.001;
};

const estimatedCost = estimateAgentStreamCost();
```

### Step 2: Check Cost Before Streaming

```typescript
const costCheck = await CostControlService.checkAndReserve({
  operationType: 'agent_stream',
  estimatedCost,
  userId: currentUser.uid,
  metadata: {
    model: 'gemini-2.5-flash',
    intent: 'track_analysis',
    inputTokens: estimatedInputTokens,
  },
});

if (!costCheck.allowed) {
  res.status(429).json({
    error: costCheck.reason,
    retryAfter: 3600, // Retry after 1 hour
  });
  return;
}
```

### Step 3: Stream Response (Safe to Proceed)

```typescript
try {
  const stream = await geminiService.generateContentStream({
    model: 'gemini-2.5-flash',
    prompt: userQuery,
    systemPrompt: agentSystemPrompt,
  });

  // Send stream to client
  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify(chunk)}\n`);
  }

  logger.info('[Agent] Stream completed', {
    operationId: costCheck.operationId,
    model: 'gemini-2.5-flash',
    cost: costCheck.estimatedCost,
    remainingBudget: costCheck.remainingBudget,
  });

  res.end();
} catch (err) {
  logger.error('[Agent] Stream failed', {
    operationId: costCheck.operationId,
    error: err.message,
  });
  res.status(500).json({ error: 'Stream failed' });
}
```

---

## Pattern 4: Multi-Segment Operations (Chain Multiple Checks)

For workflows that generate multiple outputs (e.g., video + image + audio):

```typescript
const costs = {
  video: estimateVideoCost({ durationSeconds: 10, model: 'pro', resolution: '4k' }),
  images: estimateImageCost(3),
  stream: estimateAgentStreamCost(),
};

const totalCost = Object.values(costs).reduce((a, b) => a + b, 0); // $3.32

// Single cost check for the entire workflow
const costCheck = await CostControlService.checkAndReserve({
  operationType: 'video', // Primary operation type
  estimatedCost: totalCost,
  userId: currentUser.uid,
  metadata: {
    workflow: 'album_promo_bundle',
    components: costs,
    description: 'Video + cover art + metadata extraction',
  },
});

if (!costCheck.allowed) {
  throw new Error(`Workflow blocked: ${costCheck.reason}`);
}

// Now all three operations are safe
const video = await generateVideo(...);
const images = await generateImages(...);
const metadata = await extractMetadata(...);
```

---

## Pattern 5: User Feedback on Budget Status

### Display Budget Widget

```typescript
import { CostControlService } from '@/services/billing/CostControlService';

const BudgetWidget = ({ userId }: { userId: string }) => {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    CostControlService.getStatus(userId).then(setStatus);
  }, [userId]);

  if (!status) return null;

  const dailyPercent = (status.dailyUsed / status.dailyRemaining) * 100;
  const monthlyPercent = (status.monthlyUsed / status.monthlyRemaining) * 100;

  return (
    <div className="budget-widget">
      <div className="daily">
        <label>Daily Budget</label>
        <div className="bar">
          <div
            className="fill"
            style={{ width: `${dailyPercent}%` }}
          />
        </div>
        <span>${status.dailyUsed.toFixed(2)} / ${status.dailyRemaining.toFixed(2)}</span>
      </div>

      <div className="monthly">
        <label>Monthly Budget</label>
        <div className="bar">
          <div
            className="fill"
            style={{ width: `${monthlyPercent}%` }}
          />
        </div>
        <span>${status.monthlyUsed.toFixed(2)} / ${status.monthlyRemaining.toFixed(2)}</span>
      </div>

      {monthlyPercent >= 80 && (
        <div className="alert">
          {monthlyPercent >= 100
            ? 'Monthly budget exhausted. Upgrade to continue.'
            : `Warning: ${(100 - monthlyPercent).toFixed(0)}% of monthly budget remaining.`}
        </div>
      )}
    </div>
  );
};
```

### Contextual Warnings

```typescript
const shouldWarnUser = (costCheck: CostCheckResponse): boolean => {
  const dailyRemaining = costCheck.remainingBudget;
  return dailyRemaining < 5; // Less than $5 remaining today
};

if (shouldWarnUser(costCheck)) {
  showWarning(
    `Low budget. Only $${costCheck.remainingBudget.toFixed(2)} remaining today.`,
    'Upgrade to Pro to increase your limits.',
  );
}
```

---

## Pattern 6: Error Handling & Recovery

### Graceful Degradation

```typescript
const generateWithFallback = async (params: VideoGenerationParams) => {
  const costCheck = await CostControlService.checkAndReserve({
    operationType: 'video',
    estimatedCost: estimateVideoCost(params),
    userId: currentUser.uid,
    metadata: params,
  });

  if (!costCheck.allowed) {
    // Fallback: suggest lower-cost options
    if (costCheck.reason?.includes('Daily budget')) {
      return {
        status: 'blocked',
        reason: 'Daily budget exhausted',
        suggestions: [
          { option: 'Upgrade to Pro tier', cost: 'from $25/day' },
          { option: 'Try again tomorrow', cost: 'resets midnight UTC' },
          { option: 'Contact support for emergency credit', cost: 'varies' },
        ],
      };
    }

    // For runaway protection, no fallback
    if (costCheck.reason?.includes('RUNAWAY')) {
      throw new Error('Account locked for safety. Contact support.');
    }
  }

  // Proceed with normal generation
  return await vertexAIVeoService.generateVideo(params);
};
```

### Retry Logic

```typescript
const generateWithRetry = async (params: VideoGenerationParams, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const costCheck = await CostControlService.checkAndReserve({
        operationType: 'video',
        estimatedCost: estimateVideoCost(params),
        userId: currentUser.uid,
        metadata: { ...params, attempt },
      });

      if (!costCheck.allowed) {
        throw new Error(costCheck.reason);
      }

      return await vertexAIVeoService.generateVideo(params);
    } catch (err) {
      if (attempt === maxRetries) throw err;

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
};
```

---

## Integration Checklist

Before shipping any feature that uses expensive APIs:

- [ ] Import `CostControlService` at module entry
- [ ] Estimate cost based on operation parameters
- [ ] Call `checkAndReserve()` and await response
- [ ] Check `costCheck.allowed` before calling expensive API
- [ ] Log `operationId` for audit trail
- [ ] Display user-friendly error messages on rejection
- [ ] Test with dry runs on staging
- [ ] Monitor cost ledger (`costLedger` collection in Firestore) post-launch
- [ ] Set up alerts for when users hit 80% of monthly budget

---

## FAQ

**Q: What if the cost check fails but I proceed anyway?**

A: The server-side `enforceOperationCost()` Cloud Function will block it. But it's wasteful — you'll make a network request to Vertex AI Veo, get an error, and still consume the cost check's ledger entry.

**Q: Can I batch multiple operations into a single cost check?**

A: Yes. Sum the estimated costs and pass `totalCost`. But you must reserve the total upfront. If you only use part of it, the ledger will show the full amount reserved.

**Q: How often should I refresh budget status in the UI?**

A: Call `getStatus()` once on component mount and after each expensive operation. Don't poll continuously; it's wasteful. Use real-time listeners if needed for production dashboards.

**Q: What happens if Firestore is down?**

A: `checkAndReserve()` returns `allowed: false` (fail-secure). The operation is blocked for safety. Wait and retry. Do NOT bypass the check.

---

## References

- **Cost Control Skill:** `.agent/skills/cost-control/SKILL.md`
- **Full Design:** `docs/COST_CONTROL_SYSTEM.md`
- **Service Code:** `packages/renderer/src/services/billing/CostControlService.ts`
- **Server Enforcement:** `packages/firebase/src/functions/billing/enforceOperationCost.ts`

---

**Last Updated:** 2026-05-13  
**Requirement Level:** MANDATORY for all expensive operations  
**Kill-Switch:** Active ($500/month global limit)
