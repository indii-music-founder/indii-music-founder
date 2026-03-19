# Agent Training Scorecard

Score each dimension 0–5. Document baseline before changes, rescore after rewrite.

## Scoring Rubric

| Score | Meaning |
|-------|---------|
| 0 | Absent or completely broken |
| 1 | Exists but provides no useful guidance |
| 2 | Partial — covers main cases, misses edge cases |
| 3 | Adequate — works for most real requests |
| 4 | Strong — few gaps, well-structured |
| 5 | Exemplary — comprehensive, tested, no known gaps |

## Dimensions

| Dimension | What it measures |
|-----------|-----------------|
| **Clarity** | Is the mission unambiguous? Could a new engineer understand this agent's job in 30 seconds? |
| **Specificity** | Does it cite real tools, concrete formats, measurable outputs? Or is it vague? |
| **Tool Alignment** | Does the agent know all its tools, when to use each, and how to call them correctly? |
| **Few-Shot Coverage** | Are there 3–5 complete worked examples (input → reasoning → output) in the prompt? |
| **Edge Case Handling** | Are refusals, ambiguous inputs, errors, and boundary conditions explicitly handled? |
| **Routing Accuracy** | (Hub only) Does the routing table cover all specialist domains with clear decision criteria? |
| **Guard Rails** | Does the agent have SECURITY PROTOCOL (identity lock, injection defense, domain boundary)? |

## Agent Scores

| Agent ID | Clarity | Specificity | Tool Align | Few-Shot | Edge Cases | Routing | Guard Rails | Total/35 | Status |
|----------|---------|-------------|------------|----------|------------|---------|-------------|----------|--------|
| `generalist` | 3 | 3 | 4 | 1 | 2 | 2 | 0 | 15 | NEEDS WORK |
| `finance` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `legal` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `distribution` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `marketing` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `brand` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `video` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `music` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `social` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `publicist` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `licensing` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `publishing` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `road` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `merchandise` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `director` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `producer` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `security` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `devops` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `screenwriter` | — | — | — | — | — | — | — | — | NOT AUDITED |
| `curriculum` | — | — | — | — | — | — | — | — | NOT AUDITED |

## Agent Zero Audit Notes (2026-03-19)

**Files reviewed:**
- `agents/agent0/prompts/agent.system.main.role.md` — 14 lines, very thin
- `src/services/agent/specialists/GeneralistAgent.ts` — richer, has Mode A/B/C structure

**Gaps identified:**
1. **No routing table** — `delegate_task` is a tool but there's no explicit "if user says X, route to finance" decision matrix in the prompt
2. **No few-shot examples** — zero examples of routing decisions or mode selection
3. **No SECURITY PROTOCOL** — nothing about identity lock, prompt injection defense, or domain boundaries
4. **Ambiguity gap** — no protocol for when intent spans 2+ departments (e.g., "market my tour" → marketing or road?)
5. **`agents/agent0/prompts/agent.system.main.role.md` is not used** — the real system prompt lives in `GeneralistAgent.ts` (the `.md` file appears to be legacy Agent Zero upstream config, not the indiiOS system prompt)
