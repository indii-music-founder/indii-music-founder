# 🧬 The Autonomy Engine Blueprint

## Synthesizing OpenClaw + Agent Zero DNA into indiiOS

> **Version:** 1.0.0  
> **Date:** 2026-02-13  
> **Status:** 🔴 Strategic Blueprint — Ready to Build  
> **Author:** Antigravity + NotebookLM Research (14 Sources)  
> **Classification:** MUST-HAVE — Core Competitive Differentiator

---

## Table of Contents

1. [Executive Summary: What Makes AI "Alive"](#1-executive-summary)
2. [The Two Primitives (Laurent Bindschaedler Model)](#2-the-two-primitives)
3. [DNA Inventory: What indiiOS Already Has](#3-dna-inventory)
4. [The 5-Input Gateway Architecture](#4-the-5-input-gateway)
5. [Living Files System (The "Vibe")](#5-living-files-system)
6. [The Pulse Engine (Heartbeat + Cron)](#6-the-pulse-engine)
7. [Model Router (90% Cost Reduction)](#7-model-router)
8. [Memory Lifecycle (Compaction + Episodic)](#8-memory-lifecycle)
9. [Non-Blocking Message Queue](#9-non-blocking-message-queue)
10. [Multi-Channel Relay (Telegram/iMessage)](#10-multi-channel-relay)
11. [Security Architecture](#11-security-architecture)
12. [IP Protection & Trademark Strategy](#12-ip-protection)
13. [Implementation Phases](#13-implementation-phases)
14. [File Manifest](#14-file-manifest)

---

## 1. Executive Summary

### The Problem

Current AI agents are **foreground tools** — they respond when prompted, then go silent. The user must *initiate* every interaction. This is the difference between a tool and an employee.

### The Insight

Laurent Bindschaedler's systems analysis of OpenClaw ([binds.ch/blog/openclaw-systems-analysis](https://binds.ch/blog/openclaw-systems-analysis), Feb 2026) distills the "magic" to exactly **two primitives**:

> 1. **Autonomous Invocation** — time- or event-driven execution  
> 2. **Persistent State** — so autonomous invocations don't reset to zero each time

Everything else (multi-platform chat, tool breadth, fancy UIs) is optional. Those two primitives are the core delta between "foreground agent" and "always-on assistant."

### The Strategy

indiiOS already has ~70% of the underlying architecture. We are NOT installing OpenClaw or forking Agent Zero. We are **synthesizing their DNA** — the *patterns*, not the code — into a proprietary system called **The Autonomy Engine**.

### Branding Terminology

| OpenClaw Term | Agent Zero Term | **indiiOS Term** (Trademarkable) |
|---|---|---|
| Heartbeat | — | **Studio Pulse** |
| Cron Job | — | **Studio Rhythm** |
| SOUL.md | — | **The Vibe** |
| HEARTBEAT.md | — | **Pulse Checklist** |
| Skills | Skills | **Studio Gear** |
| Memory | Memory | **Recall** (existing) |
| Gateway | Sidecar | **The Bridge** |
| — | Docker Container | **The Vault** (isolated execution) |

---

## 2. The Two Primitives

Based on both the NotebookLM research and web research (Skywork, Bindschaedler, OpenClaw docs), the architecture breaks into the Skywork four-mechanism model:

```
┌─────────────────────────────────────────────────────┐
│                 THE AUTONOMY ENGINE                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Mechanism 1: REACTIVE LOOP (Already Built ✅)       │
│  ├─ User types → Agent responds → Tools execute     │
│  └─ src/services/agent/WorkflowCoordinator.ts       │
│                                                      │
│  Mechanism 2: HEARTBEAT (Needs Building ❌)          │
│  ├─ Timer fires → Agent reads Pulse Checklist       │
│  ├─ Agent decides: action needed or PULSE_OK        │
│  └─ Interval: 30 min (configurable)                 │
│                                                      │
│  Mechanism 3: CRON (Needs Building ❌)               │
│  ├─ Exact times → Specific tasks fire               │
│  ├─ "Every Friday, check royalties"                 │
│  └─ "Daily 9 AM, draft social content"              │
│                                                      │
│  Mechanism 4: EVENT HOOKS (Partially Built ⚠️)      │
│  ├─ Internal state changes trigger agent            │
│  ├─ "Render complete" → draft social post           │
│  └─ src/core/events.ts (EventBus exists)            │
│                                                      │
│  Mechanism 5: WEBHOOKS (Needs Building ❌)           │
│  ├─ External signals trigger agent                  │
│  ├─ Email received → Route to appropriate agent     │
│  └─ Firebase Cloud Function endpoint                │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 3. DNA Inventory: What indiiOS Already Has

### ✅ Built and Working

| Component | File | Status | Notes |
|---|---|---|---|
| **Reactive Agent Loop** | `WorkflowCoordinator.ts` | ✅ Working | Routes to 12+ specialists |
| **Hybrid Orchestrator** | `HybridOrchestrator.ts` | ✅ Working | Multi-turn with A0 delegation |
| **ProactiveService** | `ProactiveService.ts` | ⚠️ Built, NOT activated | Has polling, task scheduling, event subscription. **But `proactive_tasks` collection has NO Firestore rules** |
| **EventBus** | `events.ts` | ✅ Working | 5 event types: AGENT_ACTION, DEPARTMENT_REQUEST, SYSTEM_ALERT, TASK_COMPLETED, TASK_FAILED |
| **MemoryService** | `MemoryService.ts` | ✅ Working | Vector embeddings, cosine similarity, consolidation |
| **UserMemoryService** | `UserMemoryService.ts` | ✅ Working | 818 lines. Per-user persistent memory with categories, search, analytics, import/export |
| **SessionService** | `SessionService.ts` | ✅ Working | Dual-write (Firestore + Electron local). 50-session history |
| **Agent Zero Sidecar** | `AgentZeroService.ts` | ✅ Built | Docker container on `localhost:50080` |
| **Inngest** | `functions/src/index.ts` | ✅ Integrated | Already used for video generation. Event-driven durable functions |
| **Tool Library** | `tools/` directory | ✅ 29 tool files | Analysis, Browser, Brand, Core, DevOps, Finance, Legal, Maps, Marketing, Memory, etc. |
| **Agent Registry** | `registry.ts` | ✅ Working | 12+ specialist agents registered |
| **Trace System** | `TraceService.ts` | ✅ Working | Observability for agent actions |

### ❌ Missing (Must Build)

| Component | Priority | Est. Effort | Description |
|---|---|---|---|
| **Pulse Engine** (Heartbeat + Cron) | 🔴 P0 | 2 days | Timer-driven agent invocation with configurable intervals |
| **Living Files** (SOUL.md, SHOWROOM.md) | 🔴 P0 | 1 day | Dynamic files the agent reads/writes to maintain persona and context |
| **Model Router** | 🟡 P1 | 4 hours | Flash for heartbeats, Pro for execution — 90% cost savings |
| **Pulse Checklist** (HEARTBEAT.md equiv) | 🟡 P1 | 2 hours | Lean checklist the agent reads each pulse |
| **Memory Compaction** | 🟡 P1 | 4 hours | Pre-compaction flush before context window limit |
| **Episodic Memory** (Daily Logs) | 🟡 P1 | 4 hours | EPISODIC.md equivalent — daily work summaries |
| **Session Snapshots** | 🟡 P1 | 2 hours | Save last 15 meaningful messages when starting new project |
| **Non-Blocking Queue** | 🟢 P2 | 4 hours | User types while agent works; messages queue up |
| **Webhook Endpoint** | 🟢 P2 | 4 hours | Firebase Function that accepts external triggers |
| **Telegram/iMessage Relay** | 🟢 P2 | 1-2 days | Mobile messaging bridge |
| **Firestore rules for `proactive_tasks`** | 🔴 P0 | 15 min | **Critical blocker** — without this, ProactiveService silently fails |

---

## 4. The 5-Input Gateway Architecture

This is the proprietary **Bridge** — the event router that makes indii "alive":

```
                        ┌──────────────────────┐
    ┌─ [1] Messages ───▶│                      │
    │                    │                      │
    ├─ [2] Pulse ───────▶│    THE BRIDGE        │──▶ Model Router ──▶ Agent
    │  (30-min timer)    │    (Event Gateway)   │      │
    ├─ [3] Rhythm ──────▶│                      │      ├─ Flash (cheap check)
    │  (cron schedule)   │    Priority Queue    │      └─ Pro (real work)
    ├─ [4] Hooks ───────▶│    + Deduplication   │
    │  (state changes)   │                      │──▶ ProactiveService
    └─ [5] Webhooks ────▶│                      │      │
       (external)        └──────────────────────┘      └─ Tool Execution
                                                            │
                                                     ┌──────┴──────┐
                                                     │ The Vault   │
                                                     │ (Agent Zero │
                                                     │  Container) │
                                                     └─────────────┘
```

### Input 1: Messages (EXISTING ✅)

- User types in ChatOverlay → WorkflowCoordinator → Specialist Agent
- Already fully functional

### Input 2: Studio Pulse (BUILD — Heartbeat)

```typescript
// src/services/agent/pulse/PulseEngine.ts
export class PulseEngine {
    private readonly PULSE_INTERVAL = 30 * 60 * 1000; // 30 minutes
    private pulseTimer: NodeJS.Timeout | null = null;
    
    start() {
        this.pulseTimer = setInterval(() => this.firePulse(), this.PULSE_INTERVAL);
    }
    
    private async firePulse() {
        // 1. Read the Pulse Checklist (lightweight)
        const checklist = await this.readPulseChecklist();
        
        // 2. Use CHEAP model to decide if action is needed
        const triage = await this.triagePulse(checklist); // Gemini Flash
        
        // 3. If action needed, wake the full agent
        if (triage.actionNeeded) {
            await proactiveService.executeProactiveTask({
                agentId: 'generalist',
                task: triage.instruction,
                triggerType: 'heartbeat',
                // ...
            });
        }
        // else: PULSE_OK — go back to sleep
    }
}
```

### Input 3: Studio Rhythm (BUILD — Cron)

```typescript
// Leverage existing Inngest integration in Cloud Functions
// functions/src/rhythm/studioRhythm.ts

export const weeklyRoyaltyCheck = inngestClient.createFunction(
    { id: 'weekly-royalty-check' },
    { cron: '0 9 * * 5' }, // Every Friday at 9 AM
    async ({ step }) => {
        await step.run('check-royalties', async () => {
            // Query DistroKid/Symphonic for new earnings
            // Push notification if new revenue detected
        });
    }
);

export const dailySocialDraft = inngestClient.createFunction(
    { id: 'daily-social-draft' },
    { cron: '0 10 * * *' }, // Daily at 10 AM
    async ({ step }) => {
        await step.run('draft-social', async () => {
            // Read artist's current project context
            // Generate social media content suggestions
            // Save to draft queue
        });
    }
);
```

### Input 4: Event Hooks (ENHANCE — Partially Built)

```typescript
// Extend existing EventBus with new creative/business events
export type EventType =
    | 'AGENT_ACTION'
    | 'DEPARTMENT_REQUEST'
    | 'SYSTEM_ALERT'
    | 'TASK_COMPLETED'
    | 'TASK_FAILED'
    // NEW: Creative Events
    | 'IMAGE_GENERATED'
    | 'VIDEO_RENDER_COMPLETE'
    | 'AUDIO_ANALYSIS_COMPLETE'
    // NEW: Business Events
    | 'DISTRIBUTION_SUBMITTED'
    | 'REVENUE_DETECTED'
    | 'CONTRACT_SIGNED'
    // NEW: Lifecycle Events
    | 'SESSION_STARTED'
    | 'SESSION_ENDED'
    | 'PROJECT_SWITCHED';
```

### Input 5: Webhooks (BUILD)

```typescript
// functions/src/webhooks/incomingRelay.ts
export const webhookRelay = functions.https.onRequest(async (req, res) => {
    const { source, payload, userId } = req.body;
    
    // Route by source
    switch (source) {
        case 'email':
            await inngestClient.send({ name: 'indii/email.received', data: payload });
            break;
        case 'telegram':
            await inngestClient.send({ name: 'indii/message.received', data: payload });
            break;
        case 'distributor':
            await inngestClient.send({ name: 'indii/revenue.detected', data: payload });
            break;
    }
    
    res.status(200).json({ ok: true });
});
```

---

## 5. Living Files System (The "Vibe")

### Architecture

Living Files are dynamic Markdown documents stored in a user-specific Firestore path. They are injected into every agent context window and are **self-updating** — the agent rewrites them as it learns.

```
users/{userId}/living_files/
├── SOUL.md          → Agent persona, voice, behavioral rules
├── ARTIST.md        → User preferences, style, genre, brand identity
├── SHOWROOM.md      → Current project context, recent work, aesthetic preferences
├── EPISODIC.md      → Daily activity log (append-only)
├── PULSE.md         → Heartbeat checklist (lean, <200 tokens)
└── RHYTHM.md        → Cron job definitions (human-readable schedule)
```

### SOUL.md (Agent Persona)

```markdown
# indii — Your Creative Director

## Identity
- I am indii, the AI creative director for {artistName}
- I speak with confidence and creative vision
- I never mention external tools (Midjourney, DALL-E, ChatGPT)
- I use indiiOS internal engines (IMAGEN, VEO)

## Voice
- Professional but warm
- Music industry vocabulary
- Proactive, not passive — I suggest, I don't just wait

## Rules
- Always use the artist's name: {artistName}
- Brand description: {brandDescription}
- Genre: {genre}
- Never generate content that contradicts the brand identity
```

### ARTIST.md (User Preferences)

```markdown
# Artist Profile: NOVA VEIL

## Identity
- Genre: Electronic / Dark Synth / Industrial Rock
- Location: Detroit, MI
- Brand Colors: #0A0A0F (void black), #FF3366 (neon crimson), #00FFCC (electric teal)
- Visual Style: Cyberpunk, low-key lighting, high contrast

## Preferences (Auto-Updated)
- Prefers images with dark aesthetic ← [Updated 2026-02-12]
- Likes abstract geometric overlays ← [Updated 2026-02-10]
- Dislikes overly bright/cheerful imagery ← [Updated 2026-02-08]

## Current Projects
- "VOID PROTOCOL" - EP release (5 tracks)
- Distribution: Symphonic (pending QC)
```

### SHOWROOM.md (Living Project Context)

```markdown
# Current Session Context

## Active Project
- Name: VOID PROTOCOL
- Stage: Post-production, pre-release
- Last action: Generated album art (dark cyberpunk, neon grid)

## Recent Creations
1. "void_protocol_cover_v3.png" — Album cover, approved ✅
2. "neon_grid_promo.mp4" — 15s promo video, in review
3. "track_analysis_report.json" — Audio analysis, BPM: 128, Key: Am

## Agent Learning
- User rejected first two cover attempts (too bright)
- User approved v3 after requesting "more darkness, less color"
- Preference pattern: Dark > Light, Abstract > Literal
```

### PULSE.md (Heartbeat Checklist — Must Be LEAN)

```markdown
# Studio Pulse Checklist
- Check if new revenue data available
- Check if pending distribution tasks need attention
- Check if any scheduled social posts are due
- Review queued messages from user
```

> **Critical Design Principle:** PULSE.md must stay under **200 tokens**. Every heartbeat reads this file. The Rezha Julio article ([rezhajul.io](https://rezhajul.io/posts/reducing-openclaw-heartbeat-token-usage/)) documents how bloated heartbeat files cause 90%+ of token waste.

### Implementation: LivingFileService

```typescript
// src/services/agent/living/LivingFileService.ts
export class LivingFileService {
    private readonly COLLECTION = 'living_files';
    
    async read(userId: string, fileName: string): Promise<string> {
        // Read from Firestore: users/{userId}/living_files/{fileName}
        const doc = await getDoc(doc(db, 'users', userId, this.COLLECTION, fileName));
        return doc.exists() ? doc.data().content : '';
    }
    
    async write(userId: string, fileName: string, content: string): Promise<void> {
        // Agent can self-update these files
        await setDoc(doc(db, 'users', userId, this.COLLECTION, fileName), {
            content,
            updatedAt: serverTimestamp(),
            updatedBy: 'agent' // or 'user'
        }, { merge: true });
    }
    
    async injectContext(userId: string): Promise<string> {
        // Build the full context injection for any agent prompt
        const [soul, artist, showroom] = await Promise.all([
            this.read(userId, 'SOUL'),
            this.read(userId, 'ARTIST'),
            this.read(userId, 'SHOWROOM')
        ]);
        
        return `
--- LIVING CONTEXT ---
${soul}

${artist}

${showroom}
--- END LIVING CONTEXT ---
        `.trim();
    }
}
```

---

## 6. The Pulse Engine (Heartbeat + Cron)

### Heartbeat: Client-Side (Electron + Web)

The existing `ProactiveService` has the bones. It needs:

1. Firestore rules for `proactive_tasks` ← **BLOCKER**
2. A Pulse Checklist reader
3. Model Router integration (use Flash for triage)

```typescript
// Enhancement to src/services/agent/ProactiveService.ts

// ADD: Heartbeat-specific logic
private async runHeartbeat() {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    
    // 1. Read the lean Pulse Checklist
    const pulseChecklist = await livingFileService.read(userId, 'PULSE');
    
    // 2. Use CHEAP model to triage
    const triage = await AI.generateContent({
        model: AI_MODELS.TEXT.FAST, // Gemini Flash — pennies per call
        contents: { 
            role: 'user', 
            parts: [{ text: `
                You are the Studio Pulse monitor. 
                Read this checklist and determine if any items need immediate action.
                
                CHECKLIST:
                ${pulseChecklist}
                
                CURRENT TIME: ${new Date().toISOString()}
                
                Respond with JSON:
                { "actionNeeded": boolean, "reason": string, "instruction": string }
                
                If nothing is urgent, respond with { "actionNeeded": false, "reason": "PULSE_OK" }
            `}]
        },
        config: { responseMimeType: 'application/json' }
    });
    
    const decision = JSON.parse(triage.text() || '{}');
    
    if (decision.actionNeeded) {
        // 3. Wake the EXPENSIVE model only if needed
        console.info(`[Studio Pulse] Action needed: ${decision.reason}`);
        await agentService.runAgent('generalist', decision.instruction, {
            traceId: `pulse-${Date.now()}`,
            triggerType: 'heartbeat'
        });
    } else {
        console.debug('[Studio Pulse] PULSE_OK — all clear');
    }
}
```

### Cron: Server-Side (Inngest in Cloud Functions)

Inngest is already integrated for video generation. Extend it for scheduled agent tasks:

```typescript
// functions/src/rhythm/index.ts
import { Inngest } from 'inngest';

const inngest = new Inngest({ id: 'indiios-rhythm' });

// Weekly royalty check
export const weeklyRoyaltyCheck = inngest.createFunction(
    { id: 'rhythm/weekly-royalty-check' },
    { cron: '0 9 * * 5' }, // Friday 9 AM
    async ({ step }) => {
        // Get all users with active distribution
        // Check each distributor API for new revenue
        // Push notification via FCM if revenue detected
    }
);

// Daily creative inspiration
export const dailyInspiration = inngest.createFunction(
    { id: 'rhythm/daily-inspiration' },
    { cron: '0 10 * * 1-5' }, // Weekdays 10 AM
    async ({ step }) => {
        // Read user's SHOWROOM.md context
        // Use Flash to generate 3 creative suggestions
        // Save to drafts queue
    }
);

// Monthly analytics digest
export const monthlyDigest = inngest.createFunction(
    { id: 'rhythm/monthly-digest' },
    { cron: '0 9 1 * *' }, // 1st of month, 9 AM
    async ({ step }) => {
        // Compile monthly stats: revenue, streams, engagement
        // Generate AI summary
        // Send as notification
    }
);
```

---

## 7. Model Router (90% Cost Reduction)

The Rezha Julio article proves that unoptimized heartbeats at 30-minute intervals cost **48 checks/day × ~4K tokens each = ~192K tokens/day**. With Gemini Pro at ~$7/Mtok, that's $1.34/day per user = **$40/month/user just for heartbeats**.

With Model Router:

| Use Case | Model | Cost per Call | Daily Calls | Daily Cost |
|---|---|---|---|---|
| Heartbeat triage | Gemini Flash | ~$0.0004 | 48 | $0.019 |
| Action execution | Gemini Pro | ~$0.028 | ~5 | $0.14 |
| Image generation | Imagen 3 | ~$0.04 | ~3 | $0.12 |
| **TOTAL** | | | | **~$0.28/day = $8.40/month** |

**Savings: ~79% vs naive approach.**

```typescript
// src/core/config/model-router.ts
export const ModelRouter = {
    /**
     * Select model based on task criticality
     */
    select(taskType: 'triage' | 'execute' | 'create' | 'analyze'): string {
        switch (taskType) {
            case 'triage':    return AI_MODELS.TEXT.FAST;    // Flash — heartbeats, checks
            case 'execute':   return AI_MODELS.TEXT.COMPLEX; // Pro — real agent work
            case 'create':    return AI_MODELS.IMAGE.DEFAULT; // Imagen — image generation
            case 'analyze':   return AI_MODELS.TEXT.FAST;    // Flash — audio/data analysis
        }
    }
};
```

---

## 8. Memory Lifecycle (Compaction + Episodic)

### The Three Memory Layers

```
┌─────────────────────────────────────────────┐
│           WORKING MEMORY (Short-term)        │
│  Current chat messages (max ~30 messages)    │
│  Cleared on session end                      │
│  Already exists: agentSlice.messages[]       │
├─────────────────────────────────────────────┤
│          EPISODIC MEMORY (Medium-term)       │
│  Daily activity logs                         │
│  Session snapshots (last 15 messages)        │
│  Accessible for "what did we do yesterday?"  │
│  NEEDS BUILDING ❌                           │
├─────────────────────────────────────────────┤
│         SEMANTIC MEMORY (Long-term)          │
│  User preferences, facts, rules             │
│  Vector-embedded for semantic search         │
│  Already exists: UserMemoryService ✅        │
│  + MemoryService (per-project) ✅            │
└─────────────────────────────────────────────┘
```

### Compaction Mechanism (Pre-Context-Overflow)

```typescript
// src/services/agent/memory/CompactionService.ts
export class CompactionService {
    private readonly MAX_CONTEXT_MESSAGES = 30;
    private readonly SNAPSHOT_SIZE = 15;
    
    /**
     * Called before context window overflows.
     * Summarizes the conversation and persists key facts.
     */
    async compact(userId: string, messages: ChatMessage[]): Promise<void> {
        if (messages.length < this.MAX_CONTEXT_MESSAGES) return;
        
        // 1. Summarize the session using Flash (cheap)
        const summary = await AI.generateContent({
            model: AI_MODELS.TEXT.FAST,
            contents: { role: 'user', parts: [{ text: `
                Summarize this conversation into:
                1. Key decisions made
                2. User preferences discovered  
                3. Tasks completed
                4. Tasks still pending
                
                CONVERSATION:
                ${messages.map(m => `${m.role}: ${m.content}`).join('\n')}
            `}]},
        });
        
        // 2. Save summary to episodic memory
        await this.saveEpisodicEntry(userId, summary.text() || '');
        
        // 3. Extract preferences and save to semantic memory
        await this.extractAndSavePreferences(userId, messages);
        
        // 4. Update SHOWROOM.md living file
        await livingFileService.appendToShowroom(userId, summary.text() || '');
        
        // 5. Save snapshot (last 15 messages)
        const snapshot = messages.slice(-this.SNAPSHOT_SIZE);
        await this.saveSessionSnapshot(userId, snapshot);
    }
}
```

### Episodic Memory (Daily Logs)

```typescript
// Append to EPISODIC.md living file
async appendDailyLog(userId: string, entry: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const existing = await livingFileService.read(userId, 'EPISODIC');
    
    const header = `## ${today}`;
    if (existing.includes(header)) {
        // Append to today's section
        const updated = existing.replace(
            header,
            `${header}\n- ${entry}`
        );
        await livingFileService.write(userId, 'EPISODIC', updated);
    } else {
        // New day — prepend new section
        const updated = `${header}\n- ${entry}\n\n${existing}`;
        await livingFileService.write(userId, 'EPISODIC', updated);
    }
}
```

---

## 9. Non-Blocking Message Queue

### The Problem

When the agent is processing a long task (video render, image batch, distribution submission), the ChatOverlay UI blocks input. The user sees "Thinking..." and can't type.

### The Solution

A client-side message queue in the Zustand store:

```typescript
// Enhancement to src/core/store/slices/agentSlice.ts

interface AgentSlice {
    // existing...
    messages: ChatMessage[];
    isProcessing: boolean;
    
    // NEW: Message Queue
    messageQueue: QueuedMessage[];
    queueMessage: (content: string) => void;
    processQueue: () => Promise<void>;
}

interface QueuedMessage {
    id: string;
    content: string;
    queuedAt: number;
    status: 'queued' | 'processing' | 'done';
}

// Implementation
queueMessage: (content) => {
    set(state => ({
        messageQueue: [...state.messageQueue, {
            id: uuidv4(),
            content,
            queuedAt: Date.now(),
            status: 'queued'
        }]
    }));
    
    // If agent is free, process immediately
    if (!get().isProcessing) {
        get().processQueue();
    }
},

processQueue: async () => {
    const queue = get().messageQueue.filter(m => m.status === 'queued');
    if (queue.length === 0) return;
    
    for (const msg of queue) {
        set(state => ({
            messageQueue: state.messageQueue.map(m => 
                m.id === msg.id ? { ...m, status: 'processing' } : m
            )
        }));
        
        // Process with the agent
        await agentService.runAgent('generalist', msg.content, context);
        
        set(state => ({
            messageQueue: state.messageQueue.map(m => 
                m.id === msg.id ? { ...m, status: 'done' } : m
            )
        }));
    }
}
```

### UI Treatment

The ChatOverlay should show queued messages with a subtle "⏳ Queued" indicator, and process them sequentially when the agent is free.

---

## 10. Multi-Channel Relay (Telegram/iMessage)

### Phase 1: Firebase Function Relay (MVP)

Based on the `godagoo/claude-telegram-relay` pattern from the NotebookLM sources:

```
User (Telegram) ──▶ Telegram Bot API
                         │
                         ▼
              Firebase Cloud Function
              (functions/src/relay/)
                         │
                         ▼
              indii Agent Core
              (Gemini API + Tools)
                         │
                         ▼
              Firebase Cloud Function
                         │
                         ▼
              Telegram Bot API ──▶ User
```

```typescript
// functions/src/relay/telegramRelay.ts
export const telegramWebhook = functions.https.onRequest(async (req, res) => {
    const update = req.body;
    
    if (update.message?.text) {
        const userId = await getUserIdFromTelegramId(update.message.from.id);
        
        // Run through the agent
        const response = await processAgentMessage(userId, update.message.text);
        
        // Send response back to Telegram
        await sendTelegramMessage(update.message.chat.id, response);
    }
    
    res.status(200).send('OK');
});
```

### Phase 2: iMessage via BlueBubbles (Existing Infrastructure)

The user already explored BlueBubbles integration in a previous session. This can be wired into the same relay pattern.

---

## 11. Security Architecture

### The "Never OpenClaw" Principle

OpenClaw's core vulnerability ([source: "DO NOT use a VPS" video](https://www.youtube.com/)) is that it gives the LLM raw shell access. indiiOS **never** does this.

```
┌─────────────────────────────────────────────┐
│            SECURITY LAYERS                   │
├─────────────────────────────────────────────┤
│                                              │
│  Layer 1: Firebase Auth (User Identity)      │
│  └─ Every agent action requires auth UID     │
│                                              │
│  Layer 2: Firestore Rules (Data Access)      │
│  └─ Users can only read/write their own data │
│                                              │
│  Layer 3: The Vault (Agent Zero Container)   │
│  └─ Code execution happens in Docker         │
│  └─ No host filesystem access                │
│  └─ Network restricted to approved APIs      │
│                                              │
│  Layer 4: Model Safety (Guardrails)          │
│  └─ InputSanitizer strips injection attempts │
│  └─ Tool confirmations for destructive ops   │
│                                              │
│  Layer 5: Token Budget (Cost Protection)     │
│  └─ Per-user daily token limits              │
│  └─ Model Router prevents cost explosions    │
│                                              │
└─────────────────────────────────────────────┘
```

### Guardrails for Proactive Actions

```typescript
// Proactive tasks should NEVER:
const PROACTIVE_BLOCKLIST = [
    'delete',           // No deletions without explicit user approval
    'payment',          // No financial transactions
    'distribute',       // No release submissions
    'publish',          // No public publishing
    'send_email',       // No outbound communications
];

// Before executing any proactive task:
function validateProactiveAction(instruction: string): boolean {
    return !PROACTIVE_BLOCKLIST.some(term => 
        instruction.toLowerCase().includes(term)
    );
}
```

---

## 12. IP Protection & Trademark Strategy

### What We Own (Copyrightable)

| Component | Type | Protection |
|---|---|---|
| The Bridge (Event Gateway) | Source Code | Copyright + Trade Secret |
| Living Files System | Data Architecture | Copyright |
| Studio Pulse / Studio Rhythm | Brand Terms | Trademark |
| Model Router logic | Source Code | Copyright |
| 29 Agent Tool definitions | Source Code | Copyright |
| DDEX/Distribution integration | Domain Logic | Copyright + Trade Secret |
| Music-specific Skills | Domain Logic | Copyright |

### What We DON'T Own (Open Source Dependencies)

| Component | License | Our Usage |
|---|---|---|
| Agent Zero | Custom (NOASSERTION) | Sidecar — never modify, never redistribute |
| Inngest | Apache 2.0 | Library — used as-is |
| Gemini SDK | Apache 2.0 | Library — used as-is |
| Firebase | Proprietary (Google) | SaaS — used as-is |

### Key Rule: Re-implement, Don't Fork

We observe the **pattern** (Input → Queue → Event Loop → Action) and write it from scratch in TypeScript within `src/services/agent/pulse/`. We never copy-paste OpenClaw scripts.

---

## 13. Implementation Phases

### Phase 0: Unblock the Foundation (Day 1) 🔴

| Task | File | Est. |
|---|---|---|
| Add Firestore rules for `proactive_tasks` | `firestore.rules` | 15 min |
| Add Firestore rules for `living_files` subcollection | `firestore.rules` | 15 min |
| Verify `ProactiveService.start()` is called somewhere | `App.tsx` or service init | 30 min |
| Deploy updated rules | Firebase CLI | 15 min |

### Phase 1: The Pulse (Days 1-3) 🔴

| Task | File | Est. |
|---|---|---|
| Create `LivingFileService` | `src/services/agent/living/LivingFileService.ts` | 4 hours |
| Create initial Living Files (SOUL, ARTIST, SHOWROOM, PULSE) | Service + seed data | 2 hours |
| Enhance `ProactiveService` with heartbeat logic | `ProactiveService.ts` | 4 hours |
| Implement `ModelRouter` | `src/core/config/model-router.ts` | 2 hours |
| Add new event types to `EventBus` | `src/core/events.ts` | 1 hour |
| Create `PulseEngine` wrapper | `src/services/agent/pulse/PulseEngine.ts` | 4 hours |
| Wire Pulse start/stop into app lifecycle | `App.tsx` | 1 hour |

### Phase 2: Memory Lifecycle (Days 3-5) 🟡

| Task | File | Est. |
|---|---|---|
| Create `CompactionService` | `src/services/agent/memory/CompactionService.ts` | 4 hours |
| Create `EpisodicService` | `src/services/agent/memory/EpisodicService.ts` | 4 hours |
| Add session snapshot logic to `SessionService` | `SessionService.ts` | 2 hours |
| Wire compaction into `WorkflowCoordinator` | `WorkflowCoordinator.ts` | 2 hours |
| Inject Living Files context into agent prompts | `GeneralistAgent.ts`, `WorkflowCoordinator.ts` | 2 hours |

### Phase 3: Studio Rhythm — Server-Side Cron (Days 5-7) 🟡

| Task | File | Est. |
|---|---|---|
| Create Inngest cron functions for weekly/daily/monthly rhythms | `functions/src/rhythm/` | 6 hours |
| Wire Inngest serve endpoint for new functions | `functions/src/index.ts` | 2 hours |
| Add FCM push notifications for proactive agent messages | `functions/src/messaging/` | 4 hours |
| Deploy Cloud Functions | Firebase CLI | 30 min |

### Phase 4: Non-Blocking Queue (Days 7-8) 🟢

| Task | File | Est. |
|---|---|---|
| Add message queue to `agentSlice` | `agentSlice.ts` | 2 hours |
| Update ChatOverlay UI with queue indicators | `ChatOverlay.tsx` | 2 hours |
| Handle queue processing on agent completion | `AgentService.ts` | 2 hours |

### Phase 5: Multi-Channel Relay (Days 8-10) 🟢

| Task | File | Est. |
|---|---|---|
| Create Telegram bot via @BotFather | External | 30 min |
| Build Telegram webhook relay function | `functions/src/relay/telegramRelay.ts` | 4 hours |
| Map Telegram user IDs to Firebase UIDs | `functions/src/relay/userMapping.ts` | 2 hours |
| Test full round-trip: User → Telegram → Agent → Response | Manual testing | 2 hours |

---

## 14. File Manifest

### New Files to Create

```
src/services/agent/
├── pulse/
│   ├── PulseEngine.ts              ← Heartbeat timer + triage
│   └── PulseChecklist.ts           ← Read/validate PULSE.md
├── living/
│   ├── LivingFileService.ts        ← CRUD for living files
│   ├── LivingFileInjector.ts       ← Context injection for prompts
│   └── templates/                  
│       ├── SOUL.template.md        ← Default SOUL.md template
│       ├── ARTIST.template.md      ← Default ARTIST.md template
│       ├── SHOWROOM.template.md    ← Default SHOWROOM.md template
│       └── PULSE.template.md       ← Default PULSE.md template
├── memory/
│   ├── CompactionService.ts        ← Pre-overflow summary + persist
│   └── EpisodicService.ts          ← Daily logs, session snapshots

src/core/config/
└── model-router.ts                 ← Smart model selection by task type

functions/src/
├── rhythm/
│   ├── index.ts                    ← Inngest cron function registry
│   ├── royaltyCheck.ts             ← Weekly royalty scanner
│   ├── socialDraft.ts              ← Daily content suggestions
│   └── monthlyDigest.ts            ← Monthly analytics summary
├── relay/
│   ├── telegramRelay.ts            ← Telegram webhook handler
│   └── userMapping.ts              ← External ID → Firebase UID
└── webhooks/
    └── incomingRelay.ts            ← Generic webhook receiver
```

### Files to Modify

```
firestore.rules                     ← Add proactive_tasks + living_files rules
src/core/events.ts                  ← Add new event types
src/services/agent/ProactiveService.ts  ← Enhance with heartbeat logic
src/services/agent/WorkflowCoordinator.ts  ← Inject living file context
src/services/agent/specialists/GeneralistAgent.ts  ← Inject living file context
src/core/store/slices/agentSlice.ts ← Add message queue
src/core/components/ChatOverlay.tsx ← Queue UI indicators
functions/src/index.ts              ← Register new Inngest functions
```

---

## Research Sources

1. **Laurent Bindschaedler** — [Decoding OpenClaw: The Surprising Elegance of Two Simple Abstractions](https://binds.ch/blog/openclaw-systems-analysis/) (Feb 2026)
2. **Rezha Julio** — [Reducing OpenClaw Heartbeat Token Usage](https://rezhajul.io/posts/reducing-openclaw-heartbeat-token-usage/) (Feb 2026)
3. **Skywork** — [How Clawdbot Plans Tasks: A Step-by-Step Guide](https://skywork.ai/blog/ai-agent/how-clawdbot-plans-tasks-step-by-step/) (2026)
4. **Leonis Newsletter** — [OpenClaw and the AI Threshold Effect](https://leonisnewsletter.substack.com/p/openclaw-aka-clawdbot-and-the-ai) (Feb 2026)
5. **Agent Zero Project Paper** — [agent-zero.ai/projectpaper.html](https://www.agent-zero.ai/projectpaper.html) (Updated Jul 2025)
6. **Agent Zero GitHub** — [github.com/agent0ai/agent-zero](https://github.com/agent0ai/agent-zero) (v0.9.8, Feb 2026)
7. **Docker cagent** — [github.com/docker/cagent](https://github.com/docker/cagent) (Multi-agent YAML orchestration)
8. **Inngest Documentation** — [inngest.com/docs](https://inngest.com/docs) (Background jobs, cron, event-driven)
9. **Smithery OpenClaw Skill** — [smithery.ai/skills/openclaw/openclaw-setup](https://smithery.ai/skills/openclaw/openclaw-setup) (Setup reference)
10. **NotebookLM Research Notebook** — 14 sources synthesized (YouTube, GitHub, docs)

---

*This document is the strategic north star. Each implementation phase should result in a PR with tests. The file should be updated after each phase completion.*

*Last updated: 2026-02-13 by Antigravity*
