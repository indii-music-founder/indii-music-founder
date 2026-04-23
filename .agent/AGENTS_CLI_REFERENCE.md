# agents-cli Architectural Reference for indiiOS

**Explored:** 2026-04-23  
**Source:** https://github.com/google/agents-cli  
**Goal:** Study design patterns applicable to indiiOS agent orchestration

---

## Executive Summary

Google's agents-cli is a **developer experience and safety framework** for LLM-based agents, not a runtime platform. It structures agent development as 7 mandatory phases (understand → study → scaffold → build → evaluate → deploy → observe), baking quality gates and observability into the workflow.

**Key insight:** The framework inverts traditional agent platforms by encoding methodology *into skills* that guide a human developer + LLM assistant (Claude/Gemini). It's designed to prevent common mistakes through prescriptive gating, not by restricting code.

---

## Core Abstractions

### 1. Agent Model (ADK — Agent Development Kit)

```
Agent(
  model=GoogleGenaiModel | VertexAiModel,
  instruction="system prompt",
  tools=[tool1, tool2, ...],           # Injected functions with type hints
  sub_agents=[agent_a, agent_b, ...],  # Hierarchical delegation
  output_key="answer",                 # Schema field for LLM output
  callbacks=[on_start, on_tool_call]
)
```

**Key properties:**
- Lightweight wrapper — agent = model + instructions + tools + state service
- **Composable hierarchy:** Sub-agents delegate to parent session; tools are functions with docstring-as-schema
- **Externalized state:** SessionService abstraction (memory, history, user context) decoupled from agent logic
- **Tool execution model:** Tools receive `ToolContext` with session access; LLM calls them via function-calling

**For indiiOS:** Your current `indii Conductor` (hub-and-spoke) mirrors this. Consider formalizing the tool injection pattern and externalizing state to a pluggable service (currently coupled to Zustand).

---

### 2. Tool System

**Design:**
- Tools are **plain Python functions** with type hints and docstrings
- Docstring → LLM tool definition (no separate schema objects)
- Built-in tools: `google_search`, `load_web_page`
- Extensibility: OpenAPI specs + MCP (Model Context Protocol) support

**Session context:** Tools access `ToolContext(session_service)` to read/write shared state:
```python
def my_tool(query: str, ctx: ToolContext) -> str:
    user_prefs = ctx.session.get("user:preferences")
    ctx.session.set("app:last_query", query)
    return result
```

**For indiiOS:** Your 20+ tools in `python/tools/` use this pattern. The key win: decoupled persistence lets you swap backends (in-memory → Firestore → external DB) without touching agent code.

---

### 3. Workflow Engine (ADK 2.0) — Resumable DAG

**Model:**
- Nodes: functions, agents, or tools
- Edges: control flow (sequential, branching, loops)
- **Resumable execution:** Checkpoints enable long-running workflows + human-in-the-loop without full re-runs
- Auto-wrapping: raw callables become nodes; agents/tools self-wrap

**Example use case:** Multi-step distribution pipeline
```
┌─────────────────┐
│ Ingest Metadata │
├─────────────────┤
│  Generate DDEX  │  (can pause/resume here)
├─────────────────┤
│ Validate Format │
├─────────────────┤
│ Upload to SFTP  │
├─────────────────┤
│ Confirm Delivery│  (human-in-the-loop)
└─────────────────┘
```

**For indiiOS:** Your workflow automation module (`src/modules/workflow/`) uses React Flow. Consider adopting resumable checkpoint semantics if long-running tasks need interruption recovery.

---

### 4. Skill-Based Guidance Architecture ⭐ **Strongest Pattern**

agents-cli structures the **entire framework as 7 composable skills**:

| Phase | Skill | Purpose | Anti-patterns Prevented |
|-------|-------|---------|------------------------|
| **0** | `understand` | Requirements gathering + feasibility | "Agent tries to solve before problem is clear" |
| **1** | `study` | Explore existing agents + patterns | "Reinventing the wheel" |
| **2** | `scaffold` | Template generation + CI/CD | "Debugging infra instead of agent logic" |
| **3** | `build` | Guided agent implementation | "Unstructured prompt engineering" |
| **4** | `evaluate` | Metric-driven iteration loop | "Shipping without validation" |
| **5** | `deploy` | Staged rollout (Agent Runtime → Cloud Run → GKE) | "Production outages from untested configs" |
| **6** | `observe` | 4-tier observability (Cloud Trace → BigQuery) | "Black-box failures in production" |

**Critical rule:** Phases are **mandatory in order**. Skipping Phase 0 (understanding) or Phase 4 (evaluation) is treated as a protocol violation. The skill files encode this as explicit gating.

**Why this matters:**
- Codifies institutional knowledge (e.g., "always evaluate before deploy")
- Prevents shortcuts that lead to failures
- Skills are composable but ordered — you can't merge phases but you *can* parallelize within a phase
- Errors are **checked per-phase** before proceeding (e.g., typecheck + lint before build)

**For indiiOS:** Your `.agent/` directory mirrors this structure implicitly. **Consider formalizing it:**
- Map indiiOS features to analogous phases (onboarding ~ understand, creative studio ~ build, distribution ~ deploy)
- Create mandatory skill files (`.agent/skills/<feature>/SKILL.md`) that encode best practices
- Add phase gates in CI/CD (e.g., don't deploy distribution without running DDEX validation)

---

## Evaluation & Observability

### Evaluation Metrics (LLM-as-Judge)

4 core scorers:
1. **tool_trajectory_avg_score** — Did agent use tools correctly? (0-1)
2. **final_response_match_v2** — Does output match expected schema? (binary)
3. **rubric_based_final_response_quality_v1** — Quality ranking (1-5 scale)
4. **hallucinations_v1** — Factual accuracy check (0-1)

**Workflow:**
- Generate 10-20 test cases
- Run agent on each
- Score with LLM (Claude, Gemini, or custom rubric)
- Aggregate + visualize
- Iterate on agent prompt/tools until scores improve

**For indiiOS:** You have no formal evaluation loop for agents. Consider:
- Unit tests for agent tool calls (you have these — `.test.ts` files)
- Integration tests for multi-agent flows (distribution pipeline, creative + publishing)
- LLM-as-judge for creative quality (e.g., "rate image generation output against brand guidelines")

---

### Observability (4-Tier Model)

| Layer | Example | Purpose |
|-------|---------|---------|
| **Cloud Trace** | Invocation → Agent Run → (Call LLM, Execute Tool) | Request tracing, latency breakdown |
| **Prompt Logging** | Full prompt + response for every LLM call | Debug agent reasoning |
| **BigQuery Analytics** | Tool usage frequency, error rates, cost per agent | Operational insights |
| **Third-party** | DataDog, Honeycomb integration | Custom dashboards |

**For indiiOS:** You have Firebase Analytics + BigQuery, but no hierarchical tracing. Consider adding structured logging for agent calls:
```typescript
// Pseudo-code
traceAgent("indii-conductor", async () => {
  await traceSubAgent("legal-agent", async () => {
    await traceTool("contract-review", async () => {
      // ...
    });
  });
});
```

---

## Design Trade-offs & Constraints

### ✅ Strengths for indiiOS to Adopt

1. **Tool abstraction simplicity** — Functions + docstrings, no separate schema layer
2. **State externalization** — Session service decouples persistence from agent logic
3. **Skill methodology** — Encoding phase gates prevents common failures
4. **Composable hierarchy** — Hub-and-spoke agents with dependency injection

### ⚠️ Constraints & Limitations

| Constraint | Impact | Workaround |
|-----------|--------|-----------|
| **Prescriptive workflow** | Forces Phase 0-6 even for simple agents | Offer "prototype mode" that skips infrastructure scaffolding |
| **No multi-tenant isolation** | Session keys use prefixes (`user:`, `app:`), not namespaces | Implement tenant-aware session service |
| **Tool docstring-only schema** | Type hints must be perfect; no type coercion | Use Zod or Pydantic for runtime validation |
| **Assumes LLM function-calling** | Doesn't support agents without tool-use capability | Wrapper layer for older models (fallback strategies) |

---

## Specific Recommendations for indiiOS

### 1. Formalize Agent Contract

**Current state:** Agent interfaces are implicit (indii Conductor + specialists).  
**Recommendation:** Define formal `Agent` interface with:
- `model: "gemini-2.0" | "claude-opus" | "vertex-ai"`
- `instructions: string`
- `tools: Tool[]`
- `sessionService: SessionService` (pluggable)
- `callbacks: { onStart, onToolCall, onComplete }`

**File:** `src/services/agent/types/Agent.ts`

---

### 2. Externalize Session Service

**Current state:** State lives in Zustand slices (tightly coupled).  
**Recommendation:** Inject session storage:
```typescript
interface SessionService {
  get(key: string): unknown;
  set(key: string, value: unknown): Promise<void>;
  list(prefix: string): Promise<Record<string, unknown>>;
}

// Implementations:
class InMemorySessionService implements SessionService { }
class FirestoreSessionService implements SessionService { }
class CloudDatastoreSessionService implements SessionService { }
```

**Benefits:** Swap persistence layers (testing, multi-tenant, scale) without changing agent code.

---

### 3. Adopt Phase-Gate Methodology

**Map indiiOS features to agents-cli phases:**

| Feature | Phase 0 (Understand) | Phase 4 (Evaluate) | Phase 5 (Deploy) |
|---------|---|---|---|
| **Creative Studio** | Artist intent + brand guidelines | Test image generation on 20 samples | Staging deploy before production |
| **Distribution** | Rights clearance + format requirements | Validate DDEX against DSP specs | Staged rollout (1 DSP → all DSPs) |
| **Legal** | Contract scope + risk classification | Review redaction accuracy | Deploy to production |

**Implementation:** Create `.agent/skills/<feature>/SKILL.md` for each domain with mandatory checkpoints.

---

### 4. Implement Evaluation Loop

**Minimum viable setup:**
- 10-20 test cases per agent flow
- LLM-as-judge scorers (use Gemini for cheap eval)
- Weekly eval runs in CI
- Dashboard showing metric trends

**Example scorecard:**
```
Creative Agent Eval (2026-04-23):
  image_generation_prompt_clarity: 0.92/1.0 ↑
  style_matching_accuracy: 0.85/1.0 ↓
  hallucination_rate: 0.03/1.0 ✓
  tool_trajectory_score: 0.88/1.0 ↑

Distribution Agent Eval:
  ddex_generation_correctness: 0.98/1.0 ✓
  isrc_accuracy: 1.0/1.0 ✓
  format_validation_rate: 0.95/1.0 ↓ (investigate)
```

---

### 5. Add Hierarchical Tracing

**Current state:** Firebase Analytics tracks events but no agent call hierarchy.  
**Recommendation:** Wrap agent invocations with structured tracing:

```typescript
// Pseudo-code
const trace = createTrace("indii-conductor", {
  invocationId: uuid(),
  timestamp: now(),
});

trace.addChild("legal-review-agent", async (subTrace) => {
  subTrace.addChild("contract-parsing-tool", async () => {
    // ...
  });
  subTrace.addChild("risk-assessment-tool", async () => {
    // ...
  });
});

// Export to BigQuery for analytics
```

---

## Comparison: agents-cli vs. indiiOS Current Architecture

| Aspect | agents-cli | indiiOS (Current) | Recommended for indiiOS |
|--------|-----------|-------------------|------------------------|
| **Agent Definition** | ADK: model + instructions + tools | indii Conductor service + specialist agents | Formal Agent interface + DI |
| **Tool System** | Functions + docstrings | Python tools + MCP | Standardize on one, add type validation |
| **State Management** | Pluggable SessionService | Zustand slices | Externalize to SessionService pattern |
| **Evaluation** | LLM-as-judge metrics + iteration loop | Unit tests only | Add formal eval pipeline |
| **Methodology** | 7-phase skill-based workflow | Ad hoc | Map features to phase gates |
| **Observability** | 4-tier (Trace → Logs → Analytics → Custom) | Firebase Analytics only | Add hierarchical tracing |
| **Multi-tenant** | Session key prefixes | Account/org isolation | Upgrade to namespace-based isolation |

---

## Actionable Next Steps

**P0 (This Sprint):**
- [ ] Define formal Agent interface + SessionService abstraction
- [ ] Extract session management from Zustand into pluggable service
- [ ] Create `.agent/skills/creative/SKILL.md` and `.agent/skills/distribution/SKILL.md` with phase gates

**P1 (Next Sprint):**
- [ ] Implement evaluation loop for creative + distribution agents
- [ ] Add hierarchical tracing to agent invocations
- [ ] Document tool registry + validation standards

**P2 (Future):**
- [ ] Multi-tenant session isolation
- [ ] A/B testing framework for agent variations
- [ ] Cost tracking + budget alerts per agent

---

## References

- agents-cli workflow skill: `skills/google-agents-cli-workflow/SKILL.md`
- ADK Python reference: `skills/google-agents-cli-adk-code/references/adk-python.md`
- Evaluation metrics: `skills/google-agents-cli-eval/SKILL.md`
- Observability architecture: `skills/google-agents-cli-observability/SKILL.md`

---

**Last updated:** 2026-04-23  
**Status:** Reference documentation — ready for design review
