# agents-cli Integration Assessment for indiiOS

**Evaluation Date:** 2026-04-23  
**Assessment Scope:** Feasibility, compatibility, and risk analysis  
**Decision Required:** Adopt as library? Use as reference only? Hybrid approach?

---

## Executive Summary

**Verdict: REFERENCE ONLY (not a drop-in integration)**

agents-cli is a **developer productivity tool + workflow framework**, not a runtime library. It's designed to:
- Guide humans + LLM assistants through agent development phases
- Generate boilerplate (CI/CD, eval setup, observability config)
- Enforce quality gates via skill-based methodology

It is **NOT** a multi-tenant agent orchestration platform suitable for embedded use in a production SaaS app like indiiOS.

---

## Compatibility Analysis

### ✅ What agents-cli Does Well

| Component | Value for indiiOS | Notes |
|-----------|---|---|
| **Agent abstraction** | High | Formal `Agent(model, instructions, tools, sub_agents)` interface — cleaner than implicit patterns |
| **Tool system** | Medium | Function + docstring approach is simple, but indiiOS already uses Python MCP tools |
| **State externalization** | High | SessionService pattern solves Zustand coupling problem |
| **Evaluation framework** | High | LLM-as-judge metrics + iteration loop fills gap in indiiOS |
| **Observability** | Medium | 4-tier model (Trace → Logs → Analytics → Custom) aligns with Firebase + BigQuery |

### ❌ What agents-cli Doesn't Fit

| Mismatch | Problem | Impact |
|----------|---------|--------|
| **Single-tenant assumption** | agents-cli uses session key prefixes (`user:`, `app:`, `temp:`) — not namespace-aware | Cannot isolate customer data without custom SessionService wrapper |
| **CLI-first design** | agents-cli is built for `agents-cli scaffold`, `agents-cli build` workflows | Cannot embed in web UI without heavy adaptation |
| **Opinionated workflow** | Enforces 7-phase methodology even for simple use cases | Adds friction to rapid experimentation |
| **Firebase incompatibility** | agents-cli targets Google Cloud (Cloud Run, GKE, Cloud Tasks) | Requires adapter layer to work with Firebase Functions |
| **No real-time UI** | Designed for asynchronous CLI operations | Does not integrate with indiiOS's real-time React UI (Zustand, WebSockets) |
| **Python-centric** | ADK is primarily Python; limited TypeScript support | indiiOS is Node.js + React; creates language boundary |

---

## Integration Scenarios

### Scenario 1: Full Adoption (⚠️ NOT RECOMMENDED)

**Approach:** Replace indii Conductor + specialist agents with agents-cli as the orchestration engine.

**Pros:**
- Formally structured agent abstraction
- Evaluation framework out-of-the-box
- Standardized tool system

**Cons:**
- Rewrites 40% of agent services + orchestration logic
- Forces migration from Zustand to SessionService (complex)
- Breaks real-time streaming to React UI
- Loses multi-tenant isolation without custom wrappers
- 6+ month timeline (high risk, low ROI)

**Verdict:** ❌ **Not feasible.** Cost >> benefit.

---

### Scenario 2: Hybrid — Selective Adoption (✅ RECOMMENDED)

**Approach:** Keep indii Conductor + specialist agents. Adopt specific patterns from agents-cli.

**What to adopt:**
1. **SessionService abstraction** — Extract state from Zustand into pluggable persistence layer
2. **Formal Agent interface** — Define explicit `Agent` contract for all specialists
3. **Evaluation framework** — Implement LLM-as-judge metrics for creative + distribution agents
4. **Phase-gate methodology** — Encode best practices in `.agent/skills/<feature>/SKILL.md`

**What to skip:**
- agents-cli CLI tool (keep indiiOS web UI)
- Workflow DAG engine (React Flow already covers this)
- agents-cli boilerplate generation (not applicable to SaaS app)

**Timeline:** 4-6 weeks (manageable)

**Verdict:** ✅ **Recommended.** High ROI, low risk.

---

### Scenario 3: Reference Only

**Approach:** Study agents-cli architecture but build indiiOS-native solutions.

**Pros:**
- Zero integration work
- No vendor lock-in
- Complete control over design

**Cons:**
- Reinvent evaluation framework
- No external validation of approach
- Lose access to agents-cli updates

**Verdict:** ⚠️ **Acceptable but suboptimal.** You'll eventually rebuild many of agents-cli's patterns.

---

## Detailed Compatibility Assessment

### 1. Agent Abstraction

**agents-cli Model:**
```python
agent = Agent(
    model=GoogleGenaiModel("gemini-2.0-flash"),
    instruction="You are a legal contract reviewer...",
    tools=[contract_parser, risk_scorer, redaction_tool],
    sub_agents=[extract_agent, analyze_agent],
    output_key="legal_review",
    callbacks={"on_tool_call": log_tool_call}
)
```

**indiiOS Current Model:**
```typescript
// Implicit via service classes
const legalAgent = new LegalAgentService(
  agentOrchestrator,
  toolRegistry,
  sessionState
);
await legalAgent.reviewContract(contract);
```

**Integration Path:** ✅ **Straightforward**
- Define `Agent` interface in `src/services/agent/types/Agent.ts`
- Wrap specialist agents in formal interface
- Migrate one agent at a time (legal → music → brand)
- Estimated effort: 2 weeks for all 12 specialists

---

### 2. State Management (SessionService)

**agents-cli Model:**
```python
class Agent:
    def __init__(self, session_service: SessionService):
        self.session = session_service
        
    async def run(self, input: str):
        # Read/write shared state
        user_context = self.session.get("user:context")
        await self.session.set("app:last_result", result)
```

**indiiOS Current Model:**
```typescript
// State scattered across Zustand slices
const agentState = useAgentSlice();
const creativeState = useCreativeSlice();
const distributionState = useDistributionSlice();
```

**Integration Path:** ⚠️ **Moderate Effort**
1. Define `SessionService` interface
2. Create implementations:
   - `InMemorySessionService` (testing)
   - `ZustandSessionService` (wrap Zustand slices)
   - `FirestoreSessionService` (persistent storage)
3. Inject into agents via constructor DI
4. Gradually migrate slices to SessionService patterns
5. Estimated effort: 4 weeks

**Risk:** Breaking changes to state access patterns. Requires careful migration.

---

### 3. Tool System

**agents-cli Model:**
```python
def my_tool(query: str, ctx: ToolContext) -> str:
    """Search the web for {query}."""
    results = google_search(query)
    ctx.session.set("last_search", query)
    return results
```

**indiiOS Current Model:**
```python
# python/tools/image_gen.py
@tool(name="generate_image")
def generate_image(prompt: str, style: str) -> dict:
    """Generate an image from a prompt."""
    return genkit_api.generate_image(prompt, style)
```

**Integration Path:** ✅ **Low Effort**
- Add `ToolContext` parameter to tools that need state access
- Wrap existing MCP tools with agents-cli `Tool` abstraction
- Estimated effort: 1 week

---

### 4. Evaluation Framework

**agents-cli Model:**
```
Test Set (20 samples)
  ↓
Run Agent
  ↓
Score with LLM-as-Judge
  ↓
Compute Metrics (tool accuracy, hallucination rate, quality score)
  ↓
Iterate (prompt / tools / model)
```

**indiiOS Current Model:**
```
Unit tests in *.test.ts
Manual testing in UI
No systematic evaluation
```

**Integration Path:** ✅ **High Value, Low Effort**
1. Create evaluation harness in `src/services/agent/evaluation/`
2. Define 3-4 LLM-as-judge scorers
3. Set up weekly eval runs in CI
4. Dashboard in admin panel
5. Estimated effort: 2-3 weeks

---

### 5. Multi-Tenant Isolation

**agents-cli Approach:**
```python
session_key = f"user:{user_id}:preferences"
```

**Problem for indiiOS:**
- Session keys are global; no namespace isolation
- Customer A's data could leak to Customer B if there's a bug

**Required Wrapper:**
```typescript
class TenantAwareSessionService implements SessionService {
  async get(key: string) {
    const namespaced = `tenant:${this.tenantId}:${key}`;
    return this.firestore.doc(`sessions/${namespaced}`).get();
  }
}
```

**Estimated Effort:** 1 week (1 wrapper class)

---

### 6. Real-Time UI Integration

**Problem:** agents-cli assumes async CLI workflows. indiiOS needs real-time streaming to React.

**Current indiiOS Pattern:**
```typescript
const agentState = useAgentSlice(); // Zustand hook
// Subscribe to real-time updates via WebSocket/Firebase
useEffect(() => {
  return agentState.subscribe((result) => {
    setResponse(result);
  });
}, []);
```

**agents-cli Compatibility:**
```python
# agents-cli has callbacks
agent = Agent(
    callbacks={"on_tool_call": callback}
)
```

**Integration Path:** ✅ **Straightforward**
- Wrap agents-cli callbacks to emit React state updates
- SessionService changes trigger Zustand re-renders
- Estimated effort: 1 week

---

### 7. Firebase vs. Google Cloud

**agents-cli Targets:**
- Vertex AI (LLM)
- Cloud Run (hosting)
- Cloud Tasks (job queue)
- BigQuery (analytics)

**indiiOS Uses:**
- Firebase Functions (hosting)
- Firestore (database)
- BigQuery (analytics)
- Gemini API (LLM)

**Integration Path:** ✅ **No Changes Needed**
- agents-cli's agent abstraction is model-agnostic
- Use `GeminiModel` instead of `VertexAiModel`
- SessionService can target Firestore
- Observability adapts to Firebase logging
- Estimated effort: 0 (no changes)

---

## Specific Integration Roadmap

### Phase 1: Agent Abstraction (Week 1-2)

**Deliverable:** Formal Agent interface + one prototype (Legal agent)

```typescript
// src/services/agent/types/Agent.ts
interface Agent {
  model: string;
  instructions: string;
  tools: Tool[];
  subAgents: Agent[];
  outputKey: string;
  run(input: any): Promise<any>;
}

// Implement for LegalAgent
class LegalAgent implements Agent {
  constructor(
    private sessionService: SessionService,
    private toolRegistry: ToolRegistry
  ) {}
  
  async run(contract: Contract): Promise<LegalReview> {
    // Agent orchestration logic
  }
}
```

**Tests:**
- [ ] Agent interface compiles
- [ ] Legal agent passes unit tests
- [ ] Produces same output as current implementation

---

### Phase 2: SessionService Abstraction (Week 3-4)

**Deliverable:** SessionService interface + two implementations (InMemory, Zustand wrapper)

```typescript
// src/services/agent/session/SessionService.ts
interface SessionService {
  get(key: string, tenantId?: string): Promise<any>;
  set(key: string, value: any, tenantId?: string): Promise<void>;
  delete(key: string, tenantId?: string): Promise<void>;
  list(prefix: string, tenantId?: string): Promise<Record<string, any>>;
}

class FirestoreSessionService implements SessionService {
  async get(key: string, tenantId: string): Promise<any> {
    const doc = await this.firestore
      .collection("sessions")
      .doc(`${tenantId}:${key}`)
      .get();
    return doc.data();
  }
}
```

**Tests:**
- [ ] SessionService interface compiles
- [ ] InMemory implementation works for tests
- [ ] Firestore implementation persists correctly
- [ ] Tenant isolation enforced

---

### Phase 3: Evaluation Framework (Week 5)

**Deliverable:** LLM-as-judge evaluation loop + CI integration

```typescript
// src/services/agent/evaluation/Evaluator.ts
async evaluateAgent(
  agent: Agent,
  testCases: TestCase[]
): Promise<EvaluationReport> {
  const results = [];
  for (const testCase of testCases) {
    const output = await agent.run(testCase.input);
    const scores = await scoreWithLLM(output, testCase.expected);
    results.push({ output, scores });
  }
  return aggregateMetrics(results);
}
```

**Tests:**
- [ ] Evaluation runs without errors
- [ ] Metrics computed correctly
- [ ] Results exportable to BigQuery
- [ ] CI step passes

---

### Phase 4: Skill-Based Methodology (Week 6+)

**Deliverable:** `.agent/skills/creative/SKILL.md` and `.agent/skills/distribution/SKILL.md` with phase gates

**Example SKILL.md:**
```markdown
# Creative Agent Skill

## Phase 0: Understand
- [ ] Brand guidelines defined
- [ ] Image style preferences documented
- [ ] Quality rubric approved

## Phase 1: Study
- [ ] Reviewed similar agents
- [ ] Identified common failure modes

## Phase 2: Build
- [ ] Agent instructions written
- [ ] Tools integrated
- [ ] Tested locally

## Phase 3: Evaluate
- [ ] 20+ test cases created
- [ ] LLM-as-judge eval passed (>0.85 quality score)
- [ ] Hallucination rate < 5%

## Phase 4: Deploy
- [ ] Staging deploy approved
- [ ] 48h monitoring passed
- [ ] Production rollout started
```

**Tests:**
- [ ] Skills can be invoked
- [ ] Phase gates enforced in CI

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Breaking Zustand changes** | HIGH | Feature-flag state access; gradual migration of slices |
| **Agent behavior regression** | MEDIUM | Comprehensive unit tests before/after migration; feature parity tests |
| **Multi-tenant data leak** | CRITICAL | SecurityAudit on SessionService before production; data isolation tests |
| **Real-time streaming breakage** | MEDIUM | Keep Zustand subscription model intact; test with live UI |
| **Evaluation setup overhead** | LOW | Use Gemini API for cheap eval; amortize over time |

---

## Decision Matrix

| Criterion | Scenario 1 (Full Adoption) | Scenario 2 (Hybrid) | Scenario 3 (Reference Only) |
|-----------|-----|-----|-----|
| **Timeline** | 6+ months | 4-6 weeks | 0 (no work) |
| **Risk** | Critical | Low | None |
| **ROI** | Low | High | Medium |
| **Technical Debt** | Adds (large rewrite) | Reduces (cleaner abstractions) | Neutral |
| **Real-Time UI** | Breaks | Works | Works |
| **Multi-Tenant Isolation** | Requires wrapper | Native support | No change |
| **Operational Cost** | Medium (learning curve) | Low (incremental adoption) | None |

---

## Recommendation

**✅ ADOPT SCENARIO 2 (Hybrid Approach)**

**Rationale:**
1. **SessionService abstraction** solves current Zustand coupling problem
2. **Agent interface** formalizes implicit patterns (low-risk)
3. **Evaluation framework** fills missing validation gap (high value)
4. **Phase-gate methodology** prevents future regressions (low cost)
5. **Minimal real-time UI disruption** (keep Zustand)
6. **4-6 week timeline** (manageable sprint work)

**Go/No-Go Criteria:**
- [ ] Agent interface passes proof-of-concept (Legal agent)
- [ ] SessionService doesn't break existing Zustand subscriptions
- [ ] Evaluation framework integrates with CI in under 1 week
- [ ] No regressions in multi-tenant data isolation tests

---

## Implementation Plan

**Sprint 1 (Weeks 1-2):** Agent abstraction + Legal agent prototype  
**Sprint 2 (Weeks 3-4):** SessionService abstraction + Firestore wrapper  
**Sprint 3 (Week 5):** Evaluation framework + CI integration  
**Sprint 4+ (Week 6+):** Phase-gate methodology for Creative + Distribution  

**Estimated Team Effort:** 1 senior engineer (full-time) + code review cycles

---

## References

- agents-cli source: https://github.com/google/agents-cli
- Agent abstraction spec: `.agent/AGENTS_CLI_REFERENCE.md` (Architecture section)
- SessionService pattern: `.agent/AGENTS_CLI_REFERENCE.md` (Core Abstractions → Tool System)
- Evaluation framework: `.agent/AGENTS_CLI_REFERENCE.md` (Evaluation & Observability)

---

**Assessment Complete:** 2026-04-23  
**Next Action:** Review recommendation with team lead; decide on sprint allocation.
