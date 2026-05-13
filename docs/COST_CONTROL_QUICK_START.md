# Cost Control — Quick Start for All Agents

**TL;DR:** Call `CostControlService.checkAndReserve()` before any expensive operation. Blocks at $500/month. No exceptions.

---

## The Problem

A single video generation can cost $24. If an agent generates 50 videos without limits, that's $1,200 in minutes. This happened in production and will happen again unless prevented.

## The Solution

Three layers of protection:

1. **Client-side check** (fast, prevents wasted API calls)
2. **Server-side enforcement** (final kill-switch)
3. **GCP quotas** (hard limits at infrastructure level)

---

## For Developers (5 Minutes)

### Step 1: Calculate Cost

```typescript
// Video: $0.10–0.40 per second depending on model
const videoCost = durationSeconds * (model === 'fast' ? 0.10 : 0.40);

// Image: $0.04 per image
const imageCost = imageCount * 0.04;

// Agent streaming: $0.001 per request
const streamCost = 0.001;
```

### Step 2: Check Cost

```typescript
import { CostControlService } from '@/services/billing/CostControlService';

const costCheck = await CostControlService.checkAndReserve({
  operationType: 'video',     // | 'image' | 'agent_stream'
  estimatedCost: videoCost,
  userId: currentUser.uid,
  metadata: { /* your context */ },
});

if (!costCheck.allowed) {
  throw new Error(costCheck.reason); // "Daily budget exceeded..." etc.
}
```

### Step 3: Proceed

```typescript
// Now safe to call expensive APIs
const result = await vertexAIVeoService.generateVideo(...);
```

**That's it.** No exceptions. Every expensive operation must follow this pattern.

---

## For All Agents (Mandatory Rules)

1. **Before video generation:** Call `CostControlService.checkAndReserve()` with `operationType: 'video'`
2. **Before image generation:** Call with `operationType: 'image'`
3. **Before agent streaming:** Call with `operationType: 'agent_stream'`
4. **On rejection:** Return early with user-friendly error (not a crash)
5. **Log the operationId:** For audit trail and debugging

---

## Budget Tiers (What Your Account Gets)

| Tier | Daily | Monthly | Status |
|------|-------|---------|--------|
| Free | $5 | $50 | Default for new users |
| Pro | $25 | $250 | Requires subscription |
| Enterprise | $100 | $1000 | Contact support |
| **RUNAWAY KILL-SWITCH** | — | **$500** | **NOBODY exceeds this** |

---

## What Happens If You Ignore This

1. Your agent calls an expensive API without checking cost
2. Client-side service blocks it (returns `allowed: false`)
3. You see the error message and ignore it, or you bypass the check
4. Server-side function blocks it again (final kill-switch)
5. If both somehow fail, GCP quotas block it at infrastructure level
6. Worst case: Account hits $500/month, all expensive operations locked, support ticket required

**Don't do this.** The 5-minute integration time is cheaper than debugging production incidents.

---

## Copy-Paste Examples

### Video Generation

```typescript
const costCheck = await CostControlService.checkAndReserve({
  operationType: 'video',
  estimatedCost: 8 * 0.40, // 8 seconds, pro model = $3.20
  userId: user.uid,
  metadata: { durationSeconds: 8, model: 'pro' },
});

if (!costCheck.allowed) throw new Error(costCheck.reason);

const video = await generateVideo(...);
```

### Image Generation

```typescript
const costCheck = await CostControlService.checkAndReserve({
  operationType: 'image',
  estimatedCost: 5 * 0.04, // 5 images = $0.20
  userId: user.uid,
  metadata: { imageCount: 5 },
});

if (!costCheck.allowed) throw new Error(costCheck.reason);

const images = await generateImages(...);
```

### Agent Streaming

```typescript
const costCheck = await CostControlService.checkAndReserve({
  operationType: 'agent_stream',
  estimatedCost: 0.001,
  userId: user.uid,
  metadata: { model: 'gemini-2.5-flash' },
});

if (!costCheck.allowed) return res.status(429).json({ error: costCheck.reason });

// Stream response...
```

---

## Files

| File | Purpose |
|------|---------|
| `.agent/skills/cost-control/SKILL.md` | Universal workflow (read this) |
| `packages/renderer/src/services/billing/CostControlService.ts` | Client-side implementation |
| `packages/firebase/src/functions/billing/enforceOperationCost.ts` | Server-side kill-switch |
| `docs/COST_CONTROL_SYSTEM.md` | Full technical design |
| `docs/COST_CONTROL_AGENT_INTEGRATION.md` | Integration patterns for all operation types |

---

## Testing

### Unit Test

```bash
npm test -- CostControlService.test.ts
```

### Manual Test (Staging)

1. As a free user, estimate a $6 operation → should block with "Daily budget exceeded"
2. As a Pro user, estimate a $20 operation → should allow and show $5 remaining
3. Manually set monthly total to $490 in Firestore → estimate $20 operation → should block with "RUNAWAY_PROTECTION"

---

## Questions?

- **For integration help:** Read `docs/COST_CONTROL_AGENT_INTEGRATION.md`
- **For full design:** Read `docs/COST_CONTROL_SYSTEM.md`
- **For workflow:** Read `.agent/skills/cost-control/SKILL.md`

**Golden rule:** When in doubt, call the cost check. It's fail-secure by design.

---

**Kill-Switch Active:** Yes ($500/month)  
**Enforced:** All agents, all operations  
**Last Updated:** 2026-05-13
