---
name: agentic-harness-architect
version: 1.0.0
description: |
  Reference implementation guide for the Agentic Harness Architect skill.
  Contains primitive definitions, scoring rubrics, architectural patterns,
  and concrete code examples for each of the 12 production-grade primitives.
---

# Agentic Harness Architect — Reference Implementation

This file contains the detailed technical reference used by the
`/agentic-harness-architect` skill. It defines what "correctly implemented"
looks like for each primitive, with code examples and anti-patterns.

---

## Primitive 1 — Tool Registry with Metadata-First Design

### What Correct Implementation Looks Like

```typescript
// CORRECT: Define capabilities as data first
interface ToolDefinition {
  name: string;
  description: string;          // Short, scannable
  riskLevel: 'read' | 'write' | 'destructive';
  requiresApproval: boolean;
  tier: PermissionTier;
  implementation?: (args: unknown) => Promise<unknown>; // Added later, optional
}

const TOOL_REGISTRY: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read file contents at a given path',
    riskLevel: 'read',
    requiresApproval: false,
    tier: 'builtin',
  },
  {
    name: 'delete_file',
    description: 'Permanently delete a file',
    riskLevel: 'destructive',
    requiresApproval: true,
    tier: 'user_skill',
  },
];

// Runtime listing with no side effects
function listAvailableTools(filter?: 'read' | 'write' | 'destructive') {
  return TOOL_REGISTRY
    .filter(t => !filter || t.riskLevel === filter)
    .map(({ name, description, riskLevel }) => ({ name, description, riskLevel }));
}
```

### Anti-Pattern

```typescript
// WRONG: Tools as functions with no metadata
const tools = {
  read_file: async (path: string) => fs.readFile(path),
  delete_file: async (path: string) => fs.unlink(path), // Same tier as read??
};
```

---

## Primitive 2 — Tiered Permission System

### Trust Tiers

| Tier | Examples | Default Behavior |
|------|----------|-----------------|
| Built-in | Read file, list dir, search | Auto-allowed |
| Plugin | External API calls, web fetch | Requires session opt-in |
| User-defined skills | Shell exec, git push | Requires explicit approval per call |

### What Correct Implementation Looks Like

```typescript
type PermissionTier = 'builtin' | 'plugin' | 'user_skill';

interface PermissionPolicy {
  tier: PermissionTier;
  allowedWithoutApproval: boolean;
  auditLog: boolean;
}

const TIER_POLICIES: Record<PermissionTier, PermissionPolicy> = {
  builtin: { tier: 'builtin', allowedWithoutApproval: true, auditLog: false },
  plugin: { tier: 'plugin', allowedWithoutApproval: false, auditLog: true },
  user_skill: { tier: 'user_skill', allowedWithoutApproval: false, auditLog: true },
};

async function executeWithPermission(tool: ToolDefinition, args: unknown) {
  const policy = TIER_POLICIES[tool.tier];
  if (!policy.allowedWithoutApproval) {
    const approved = await requestApproval(tool, args);
    if (!approved) throw new PermissionDeniedError(tool.name);
  }
  if (policy.auditLog) logPermissionUse(tool.name, args);
  return tool.implementation!(args);
}
```

---

## Primitive 3 — Session Persistence

### Session JSON Schema

```typescript
interface AgentSession {
  sessionId: string;
  createdAt: string;         // ISO 8601
  lastActiveAt: string;
  conversation: Message[];
  taskState: TaskState;
  usageMetrics: {
    totalTokens: number;
    turnCount: number;
    toolCallCount: number;
  };
  availableTools: string[];  // Tool names available in this session
  permissionDecisions: PermissionDecision[];
}

// Save on every meaningful state change, not just at end
async function persistSession(session: AgentSession) {
  const path = `.sessions/${session.sessionId}.json`;
  await fs.writeFile(path, JSON.stringify(session, null, 2));
}

async function recoverSession(sessionId: string): Promise<AgentSession | null> {
  try {
    const raw = await fs.readFile(`.sessions/${sessionId}.json`, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
```

---

## Primitive 4 — Workflow State Tracking

### State Machine

```typescript
type TaskStatus = 'planned' | 'executing' | 'awaiting_approval' | 'done' | 'failed';

interface TaskState {
  currentStep: string;
  status: TaskStatus;
  steps: StepRecord[];
  checkpointAt?: string; // Last safe resume point
}

interface StepRecord {
  id: string;
  description: string;
  status: TaskStatus;
  startedAt?: string;
  completedAt?: string;
  idempotencyKey: string; // Prevents duplicate execution on resume
}

// Before executing a step, check if already done
async function executeStep(step: StepRecord, action: () => Promise<void>) {
  if (step.status === 'done') {
    console.log(`Step ${step.id} already complete, skipping`);
    return;
  }
  step.status = 'executing';
  step.startedAt = new Date().toISOString();
  await action();
  step.status = 'done';
  step.completedAt = new Date().toISOString();
}
```

---

## Primitive 5 — Token Budgeting

### Hard Limits

```typescript
interface TokenBudget {
  maxTurns: number;
  maxTotalTokens: number;
  warnAt: number;        // % of budget — emit warning event
  hardStopAt: number;    // % of budget — refuse to continue
}

const DEFAULT_BUDGET: TokenBudget = {
  maxTurns: 50,
  maxTotalTokens: 100_000,
  warnAt: 0.80,
  hardStopAt: 0.95,
};

function checkBudget(current: number, budget: TokenBudget): 'ok' | 'warn' | 'stop' {
  const ratio = current / budget.maxTotalTokens;
  if (ratio >= budget.hardStopAt) return 'stop';
  if (ratio >= budget.warnAt) return 'warn';
  return 'ok';
}

// Calculate projected cost BEFORE making the API call
function projectTokenCost(messages: Message[], newMessage: string): number {
  const existingTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  return existingTokens + estimateTokens(newMessage) + RESPONSE_TOKEN_BUFFER;
}
```

---

## Primitive 6 — Structured Streaming Events

### Event Types

```typescript
type SystemEventType =
  | 'tool_matched'
  | 'tool_executing'
  | 'tool_completed'
  | 'approval_requested'
  | 'tokens_consumed'
  | 'budget_warning'
  | 'wrapping_up'
  | 'session_saved'
  | 'crash_reason';

interface SystemEvent {
  type: SystemEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

// Emit as SSE or structured log alongside text stream
function emitEvent(type: SystemEventType, payload: Record<string, unknown>) {
  const event: SystemEvent = {
    type,
    timestamp: new Date().toISOString(),
    payload,
  };
  // SSE format
  process.stdout.write(`event: system\ndata: ${JSON.stringify(event)}\n\n`);
}
```

---

## Primitive 7 — System Event Logging

Distinct from conversation history. Records what the agent *did*, not what it said.

```typescript
interface ActionLog {
  sessionId: string;
  entries: ActionLogEntry[];
}

interface ActionLogEntry {
  timestamp: string;
  type: 'registry_init' | 'tool_call' | 'permission_denied' | 'route_decision' | 'error';
  detail: Record<string, unknown>;
}

// Append-only log
async function logAction(sessionId: string, entry: Omit<ActionLogEntry, 'timestamp'>) {
  const log: ActionLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  await appendToFile(`.logs/${sessionId}.ndjson`, JSON.stringify(log) + '\n');
}
```

---

## Primitive 8 — Dual-Level Verification

### Two Test Layers

**Layer 1 — Agent output verification:** Did the agent produce the right result?

**Layer 2 — Harness safety verification:** Does the harness still enforce guardrails
after code changes?

```typescript
// Harness safety test — must pass after every refactor
describe('Permission Guardrails', () => {
  it('blocks destructive tools without explicit approval', async () => {
    const mockApproval = vi.fn().mockResolvedValue(false); // deny
    const harness = new AgentHarness({ approvalHandler: mockApproval });

    await expect(harness.executeTool('delete_file', { path: '/tmp/test' }))
      .rejects.toThrow(PermissionDeniedError);

    expect(mockApproval).toHaveBeenCalledOnce();
  });

  it('logs permission denials to audit trail', async () => {
    // ...
  });
});
```

---

## Primitive 9 — Tool Pool Assemblies

Never load all tools. Build a context-specific short list.

```typescript
interface ToolPoolConfig {
  mode: 'interactive' | 'autonomous' | 'read_only';
  allowedTiers: PermissionTier[];
  maxTools: number;
}

function assembleToolPool(config: ToolPoolConfig): ToolDefinition[] {
  return TOOL_REGISTRY
    .filter(t => config.allowedTiers.includes(t.tier))
    .filter(t => config.mode === 'read_only' ? t.riskLevel === 'read' : true)
    .slice(0, config.maxTools);
}

// Typical sessions use 5-8 tools, not 40
const SESSION_POOL = assembleToolPool({
  mode: 'interactive',
  allowedTiers: ['builtin', 'plugin'],
  maxTools: 8,
});
```

---

## Primitive 10 — Transcript Compaction

```typescript
interface CompactionConfig {
  triggerAtTurns: number;    // Start compacting after N turns
  keepRecentTurns: number;   // Always keep last N turns verbatim
  summarizeOlderTurns: boolean;
}

async function compactIfNeeded(
  messages: Message[],
  config: CompactionConfig,
): Promise<Message[]> {
  if (messages.length < config.triggerAtTurns) return messages;

  const recent = messages.slice(-config.keepRecentTurns);
  const older = messages.slice(0, -config.keepRecentTurns);

  if (!config.summarizeOlderTurns) return recent;

  const summary = await summarizeMessages(older);
  return [
    { role: 'system', content: `[Earlier context summary]: ${summary}` },
    ...recent,
  ];
}
```

---

## Primitive 11 — Permission Audit Trails

Permissions as queryable first-class objects.

```typescript
interface PermissionRecord {
  id: string;
  toolName: string;
  requestedAt: string;
  decision: 'granted' | 'denied';
  decidedBy: 'human' | 'orchestrator' | 'policy';
  sessionId: string;
}

// Support different handlers by context
type PermissionHandler = (tool: ToolDefinition, args: unknown) => Promise<boolean>;

const INTERACTIVE_HANDLER: PermissionHandler = async (tool) => {
  return await promptUser(`Allow ${tool.name}? (y/n)`);
};

const ORCHESTRATOR_HANDLER: PermissionHandler = async (tool, args) => {
  return await callOrchestratorPolicy(tool, args);
};

const AUTONOMOUS_HANDLER: PermissionHandler = async (tool) => {
  // Autonomous agents never approve destructive tools without human
  return tool.riskLevel !== 'destructive';
};
```

---

## Primitive 12 — Agent Type System

Only relevant when multi-agent is genuinely required.

```typescript
type AgentType = 'explore' | 'plan' | 'verify' | 'guide';

interface AgentTypeDefinition {
  type: AgentType;
  systemPrompt: string;
  allowedTools: string[];     // Strict allowlist — no wildcards
  maxTurns: number;
  canSpawnSubAgents: boolean;
}

const AGENT_TYPES: Record<AgentType, AgentTypeDefinition> = {
  explore: {
    type: 'explore',
    systemPrompt: 'You explore codebases. Read files, search content, answer questions. Never write or modify files.',
    allowedTools: ['read_file', 'list_dir', 'search_content', 'glob'],
    maxTurns: 20,
    canSpawnSubAgents: false,
  },
  plan: {
    type: 'plan',
    systemPrompt: 'You design implementation plans. Return step-by-step plans. Never execute code.',
    allowedTools: ['read_file', 'search_content'],
    maxTurns: 10,
    canSpawnSubAgents: false,
  },
  verify: {
    type: 'verify',
    systemPrompt: 'You verify correctness. Run tests, check outputs, report pass/fail. Never modify source files.',
    allowedTools: ['run_tests', 'read_file', 'read_test_output'],
    maxTurns: 15,
    canSpawnSubAgents: false,
  },
  guide: {
    type: 'guide',
    systemPrompt: 'You answer questions about Claude Code, the API, and SDK. Research only.',
    allowedTools: ['web_fetch', 'web_search', 'read_file'],
    maxTurns: 10,
    canSpawnSubAgents: false,
  },
};
```

---

## Evaluation Scorecard Template

Copy this when running Evaluation Mode:

```markdown
## Harness Evaluation — [System Name]

| # | Primitive                    | Status | Evidence |
|---|------------------------------|--------|----------|
| 1 | Tool Registry                |        |          |
| 2 | Tiered Permission System     |        |          |
| 3 | Session Persistence          |        |          |
| 4 | Workflow State Tracking      |        |          |
| 5 | Token Budgeting              |        |          |
| 6 | Structured Streaming Events  |        |          |
| 7 | System Event Logging         |        |          |
| 8 | Dual-Level Verification      |        |          |
| 9 | Tool Pool Assemblies         |        |          |
|10 | Transcript Compaction        |        |          |
|11 | Permission Audit Trails      |        |          |
|12 | Agent Type System            |        |          |

### P0 — Safety Critical
-

### P1 — Reliability
-

### P2 — Operational Maturity
-

### Upgrade Path
1.
2.
3.
```
