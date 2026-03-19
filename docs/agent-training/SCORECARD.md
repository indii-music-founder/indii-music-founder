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
| **Routing Accuracy** | (Hub) Full routing table coverage. (Spokes) Out-of-scope routing clarity to correct agent. |
| **Guard Rails** | Does the agent have SECURITY PROTOCOL (identity lock, injection defense, domain boundary)? |

## Agent Scores

> Last full audit: 2026-03-20. All 20 agents trained with rewritten prompts + 20 gold dataset examples each.
> Generalist baseline was 15/35. All agents below reflect post-rewrite scores.

| Agent ID | Clarity | Specificity | Tool Align | Few-Shot | Edge Cases | Routing | Guard Rails | Total/35 | Status |
|----------|---------|-------------|------------|----------|------------|---------|-------------|----------|--------|
| `generalist` | 5 | 5 | 4 | 5 | 5 | 5 | 5 | **34** | ✅ DONE |
| `finance` | 5 | 4 | 4 | 5 | 4 | 4 | 5 | **31** | ✅ DONE |
| `legal` | 5 | 4 | 4 | 5 | 4 | 4 | 5 | **31** | ✅ DONE |
| `distribution` | 5 | 5 | 5 | 5 | 4 | 4 | 5 | **33** | ✅ DONE |
| `marketing` | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **35** | ✅ DONE |
| `brand` | 5 | 5 | 4 | 5 | 4 | 4 | 5 | **32** | ✅ DONE |
| `video` | 5 | 5 | 5 | 5 | 5 | 4 | 5 | **34** | ✅ DONE |
| `music` | 5 | 5 | 4 | 5 | 5 | 4 | 4 | **32** | ✅ DONE |
| `social` | 5 | 5 | 5 | 5 | 4 | 4 | 5 | **33** | ✅ DONE |
| `publicist` | 5 | 5 | 5 | 5 | 4 | 4 | 5 | **33** | ✅ DONE |
| `licensing` | 5 | 5 | 5 | 5 | 4 | 4 | 5 | **33** | ✅ DONE |
| `publishing` | 5 | 4 | 4 | 5 | 4 | 4 | 5 | **31** | ✅ DONE |
| `road` | 5 | 4 | 4 | 5 | 4 | 4 | 5 | **31** | ✅ DONE |
| `merchandise` | 5 | 4 | 4 | 5 | 4 | 4 | 5 | **31** | ✅ DONE |
| `director` | 5 | 5 | 5 | 5 | 4 | 4 | 5 | **33** | ✅ DONE |
| `producer` | 5 | 4 | 3 | 5 | 4 | 4 | 4 | **29** | ✅ DONE |
| `security` | 5 | 4 | 4 | 5 | 5 | 4 | 5 | **32** | ✅ DONE |
| `devops` | 5 | 5 | 5 | 5 | 4 | 4 | 5 | **33** | ✅ DONE |
| `screenwriter` | 5 | 4 | 3 | 5 | 5 | 4 | 5 | **31** | ✅ DONE |
| `curriculum` | 5 | 5 | 3 | 5 | 4 | 4 | 5 | **31** | ✅ DONE |

## Score Notes

### Why some agents score below 35

**Tool Alignment < 5:**
- `generalist` (4): delegate_task is well-documented but no typed examples for every single specialist
- `finance` / `legal` (4): Core tools documented but function implementations are AI-generated stubs
- `music` (4): Only 3 tools documented; `functions` object is empty (tools run via Gemini natively)
- `brand` (4): Core tools documented; vision-based analysis tools have complex multi-parameter examples
- `producer` / `screenwriter` (3): Both have only 2 tools implemented; limited by what's actually built

**Guard Rails < 5:**
- `music` (4): Security protocol block present but shorter than the standard 6-rule template
- `producer` (4): Security protocol uses 4 numbered rules vs. the standard bold-header format

**Routing < 5 (hub):**
- All spoke agents score 4 because routing is inferred from OUT OF SCOPE tables rather than explicit targetAgentId calls

### Agents to watch for improvement
- `producer`: Only 2 tools (create_call_sheet, breakdown_script) — when more production tools are built, Tool Align will jump
- `screenwriter`: Only 2 tools (format_screenplay, analyze_script_structure) — same
- `curriculum`: Tool documentation thin (indii_oracle call examples missing)

## Agent Zero Audit Notes (2026-03-19 — Baseline)

**Files reviewed:**
- `agents/agent0/prompts/agent.system.main.role.md` — 14 lines, very thin (legacy/unused)
- `src/services/agent/specialists/GeneralistAgent.ts` — richer, has Mode A/B/C structure

**Baseline score: 15/35** (Clarity:3, Specificity:3, ToolAlign:4, FewShot:1, EdgeCase:2, Routing:2, GuardRails:0)

**Gaps identified (all fixed):**
1. No routing table → Added 19-domain SPECIALIST ROUTING TABLE
2. No few-shot examples → Added 5 worked examples (routing, generation, multi-domain, adversarial)
3. No SECURITY PROTOCOL → Added full block (identity lock, injection defense, domain boundary, jailbreak patterns)
4. Ambiguity gap → Added AMBIGUITY PROTOCOL with priority chain
5. Legacy .md file is unused → Documented in MASTER_TRAINING_PLAN.md known issues
