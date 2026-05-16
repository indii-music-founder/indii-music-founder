---
name: Agent Onboarding Protocol
description: Critical procedures for adding agents, test mocking, code mutations, and branch management. Follow exactly — do not defer or skip.
---

# Agent Onboarding & Operational Protocols

## 1. Adding a New Agent to the System (MANDATORY CHECKLIST)

When onboarding a new agent (e.g., new specialist, new model variant), follow this exact sequence. **Do not defer registry updates.**

### 1.1 — Register Agent ID

**File:** `packages/renderer/src/services/agent/types.ts`

Add the new agent to `VALID_AGENT_IDS`:

```typescript
export const VALID_AGENT_IDS = [
  'conductor',
  'creative',
  'marketing',
  // ... existing agents
  'your-new-agent',  // ← ADD HERE
] as const;
```

**Must happen FIRST.** All downstream references depend on this type definition.

### 1.2 — Register in Fine-Tuned Model Registry

**File:** `packages/renderer/src/services/agent/fine-tuned-models.ts`

Add entry to `FINE_TUNED_MODEL_REGISTRY`:

```typescript
export const FINE_TUNED_MODEL_REGISTRY = {
  conductor: 'gemini-2.0-flash-exp',
  creative: 'gemini-2.0-flash-exp',
  // ... existing agents
  'your-new-agent': undefined,  // ← ADD (set to undefined if not fine-tuned yet)
} as const;
```

**Must match agent ID from Step 1.1 exactly.** Set to `undefined` if the agent doesn't have a fine-tuned model yet. Do not leave out.

### 1.3 — Full Registration in Agent Registry

**File:** `packages/renderer/src/services/agent/agentRegistry.ts`

Add full registration with metadata, loader, and card generator:

```typescript
export const agentRegistry: AgentRegistryEntry[] = [
  // ... existing agents
  {
    id: 'your-new-agent' as const,
    name: 'Your New Agent',
    description: 'What this agent does',
    capabilities: ['capability1', 'capability2'],
    getCardForAgent: () => getCardForAgent('your-new-agent'),
    loader: async () => {
      const { YourNewAgentComponent } = await import(
        '@/modules/agents/YourNewAgent'
      );
      return YourNewAgentComponent;
    },
  },
];
```

**All three fields are required.** Missing any one will cause test failures.

### 1.4 — Test Validation (BEFORE COMMIT)

Run tests to verify registration is complete:

```bash
npm test -- --run FineTunedModel.validation.test.ts
npm test -- --run agent_tools_accessibility.test.ts
```

**Both tests MUST pass.** If either fails:
- Check that agent ID is in `VALID_AGENT_IDS`
- Check that agent has entry in `FINE_TUNED_MODEL_REGISTRY`
- Check that `agentRegistry.ts` has full registration with all three fields
- Re-run tests after fixing

**Do not commit until both tests pass.**

### 1.5 — Commit

Only after all four steps above are complete and tests pass:

```bash
git add packages/renderer/src/services/agent/types.ts \
        packages/renderer/src/services/agent/fine-tuned-models.ts \
        packages/renderer/src/services/agent/agentRegistry.ts

git commit -m "feat(agents): register new-agent with metadata and fine-tuned model entry"
```

---

## 2. Test Mocking Protocol (MANDATORY)

### 2.1 — Never Use Global Env Vars to Control Test Behavior

**WRONG:**

```typescript
// test/setup.ts
process.env.MOCK_MODE = 'true';  // ← BAD: affects all tests globally
```

Tests become brittle and dependent on setup order. Other tests break when you "just" set an env var.

### 2.2 — Use Per-Test Mocking

**CORRECT: Option A — File-level mock**

```typescript
// src/services/ai/AIService.test.ts
vi.mock('../AIService', () => ({
  callGemini: vi.fn().mockResolvedValue({ text: 'mocked' }),
}));

describe('AIService', () => {
  it('calls Gemini', async () => {
    const result = await callGemini();
    expect(result).toEqual({ text: 'mocked' });
  });
});
```

**CORRECT: Option B — Per-test override**

```typescript
describe('AIService', () => {
  it('calls real Gemini', async () => {
    vi.mocked(callGemini).mockResolvedValueOnce({ text: 'real' });
    const result = await callGemini();
    expect(result).toEqual({ text: 'real' });
  });

  it('calls mocked Gemini', async () => {
    vi.mocked(callGemini).mockResolvedValueOnce({ text: 'mock' });
    const result = await callGemini();
    expect(result).toEqual({ text: 'mock' });
  });
});
```

### 2.3 — Feature Flag Pattern (For Complex Mock Modes)

If you need a reusable mock mode, use feature flags that tests **opt into**, not opt out of:

```typescript
// src/services/ai/mockGemini.ts
export const MOCK_GEMINI = {
  enabled: false,
  responses: new Map<string, string>(),

  enable: (query: string, response: string) => {
    MOCK_GEMINI.enabled = true;
    MOCK_GEMINI.responses.set(query, response);
  },

  disable: () => {
    MOCK_GEMINI.enabled = false;
    MOCK_GEMINI.responses.clear();
  },
};

// src/services/ai/AIService.ts
export async function callGemini(query: string) {
  if (MOCK_GEMINI.enabled && MOCK_GEMINI.responses.has(query)) {
    return MOCK_GEMINI.responses.get(query);
  }
  // real implementation
}

// src/services/ai/AIService.test.ts
describe('AIService with mocking', () => {
  beforeEach(() => {
    MOCK_GEMINI.enable('test query', 'mocked response');
  });

  afterEach(() => {
    MOCK_GEMINI.disable();
  });

  it('uses mock when enabled', async () => {
    const result = await callGemini('test query');
    expect(result).toBe('mocked response');
  });
});
```

**Key:** Tests explicitly enable what they need. Default is off. No surprise side effects.

---

## 3. Code Mutations Protocol (MANDATORY)

When modifying files, especially large ones or files with many similar sections:

### 3.1 — Read the Full File Once

```bash
# Read entire file into memory/script
cat src/services/agent/agentRegistry.ts > /tmp/agent-registry.txt
```

Do not read incrementally. You lose context.

### 3.2 — Make Changes in Memory or Script

Plan the changes. Write them down. Think through side effects.

### 3.3 — Write Once

Use a single `sed`, script, or edit operation. Do not loop multiple times:

**WRONG:**

```bash
sed -i 's/oldPattern1/newPattern1/g' file.ts
sed -i 's/oldPattern2/newPattern2/g' file.ts
sed -i 's/oldPattern3/newPattern3/g' file.ts
# ← Multiple passes, risk of partial edits and duplicates
```

**CORRECT:**

```bash
sed -i -e 's/oldPattern1/newPattern1/g' \
       -e 's/oldPattern2/newPattern2/g' \
       -e 's/oldPattern3/newPattern3/g' file.ts
# ← Single pass, atomic
```

### 3.4 — Verify After Writing

Always check the file was written correctly:

```bash
tail -20 src/services/agent/agentRegistry.ts
# Look for duplicates, incomplete lines, syntax errors
```

Commit only after visual verification.

---

## 4. Branch Management Protocol (MANDATORY)

### 4.1 — Sync Daily with Main

If `main` is actively changing (multiple agents working in parallel):

```bash
git fetch origin main
git merge origin/main
# Resolve conflicts immediately, do not defer
```

Do this **daily** or **before each push**.

### 4.2 — Pre-Push Sync Check

Before pushing, always fetch and merge:

```bash
git fetch origin main && git merge origin/main
# Catches conflicts early, before they cascade
```

This is non-negotiable.

### 4.3 — Commit Ahead Limit

**Never let a branch get more than 10 commits ahead of main without a sync point.**

If you have >10 commits:

1. **Consolidate** using Step 0 of `/ci-validate`
2. **Sync with main** to verify consolidation doesn't conflict
3. **Then push**

This prevents the 100+ commit cascades that cause CI nightmare cycles.

---

## Quick Checklist: Before Every Push

```bash
# 1. Sync with main
git fetch origin main && git merge origin/main

# 2. Check commit count
COMMITS=$(git rev-list --count main..HEAD)
if [ "$COMMITS" -gt 10 ]; then
  echo "⚠ WARNING: $COMMITS commits ahead. Run /ci-validate Step 0 consolidation."
  exit 1
fi

# 3. Check for agent registry issues (if adding/modifying agents)
npm test -- --run FineTunedModel.validation.test.ts agent_tools_accessibility.test.ts

# 4. Run full CI validation
/ci-validate

# 5. Push
git push origin $(git branch --show-current)
```

---

## Permanent Reference

These protocols are mandatory:

| Protocol | When | Why |
| --- | --- | --- |
| Agent registration (3 files + tests) | Adding a new agent | Prevents runtime errors and test failures |
| Per-test mocking, not global setup | Writing tests | Prevents test pollution and brittle behavior |
| Single-pass mutations, verify after | Editing large files | Prevents duplicates and partial edits |
| Daily sync, pre-push check, 10-commit limit | Branch work | Prevents 100+ commit cascades and CI nightmares |

**Do not skip. Do not defer. Do not rationalize exceptions.**
