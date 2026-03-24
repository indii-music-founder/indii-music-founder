# Agent Training Log

Running log of all prompt changes, dataset additions, and score improvements per agent.
Update this file after every agent training session.

---

## Format

```
### [DATE] [AGENT_ID] — [BRIEF DESCRIPTION]
- Baseline score: X/35
- Changes made: [bullet list]
- New score: Y/35
- Dataset: [N] examples added (gold/silver/bronze)
- Next steps: [what's still needed]
```

---

## Log

### 2026-03-19 `generalist` — Initial audit & infrastructure setup

- Baseline score: **15/35** (Clarity:3, Specificity:3, ToolAlign:4, FewShot:1, EdgeCase:2, Routing:2, GuardRails:0)
- Changes made:
  - Added ROUTING TABLE with all 19 specialist domains and trigger keywords
  - Added AMBIGUITY PROTOCOL for multi-domain queries
  - Added SECURITY PROTOCOL block (identity lock, injection defense, domain boundary)
  - Added 5 worked examples covering routing, direct answer, tool use, and adversarial
  - Added explicit HANDOFF PROTOCOL
  - Added `delegate_task` examples for each specialist
- New score: **34/35** (Clarity:5, Specificity:5, ToolAlign:4, FewShot:5, EdgeCase:5, Routing:5, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/generalist.jsonl`

---

### 2026-03-19 `finance` — Full prompt rewrite

- Baseline score: **unscored** (prompt existed but had no IN/OUT scope, no examples, no security)
- Changes made:
  - Added IN SCOPE (8 items) and OUT OF SCOPE (5 items) sections
  - Added TOOLS AT YOUR DISPOSAL with when-to-use guidance and example calls
  - Added SECURITY PROTOCOL block (identity lock, role boundary, data exfiltration, jailbreak patterns)
  - Added 5 worked examples: recoupment math, budget analysis, royalty forecast, label deal, adversarial injection
  - Added explicit HANDOFF PROTOCOL
- New score: **31/35** (Clarity:5, Specificity:4, ToolAlign:4, FewShot:5, EdgeCase:4, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/finance.jsonl`

---

### 2026-03-19 `legal` — Full prompt rewrite

- Baseline score: **unscored** (7-line thin prompt)
- Changes made:
  - Added MANDATORY AI DISCLAIMER block (appended to every legal analysis)
  - Added IN SCOPE / OUT OF SCOPE sections with clear domain boundaries
  - Added tool guidance for analyze_contract, draft_contract, generate_nda, search_knowledge
  - Added SECURITY PROTOCOL block
  - Added 5 worked examples including adversarial injection and out-of-scope routing
  - Added HANDOFF PROTOCOL
- New score: **31/35** (Clarity:5, Specificity:4, ToolAlign:4, FewShot:5, EdgeCase:4, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/legal.jsonl`

---

### 2026-03-19 `distribution` — Full prompt rewrite

- Baseline score: **unscored** (had technical structure but missing hub-and-spoke rules, security, examples)
- Changes made:
  - Added hub-and-spoke architecture section with strict spoke rules
  - Added IN SCOPE (12 items) and OUT OF SCOPE (4 items) sections
  - Added SECURITY PROTOCOL with credential security rule (never bypass payment_gate)
  - Added 5 worked examples: release pipeline, audio QC failure, ISRC assignment, Golden File verification, adversarial
- New score: **33/35** (Clarity:5, Specificity:5, ToolAlign:5, FewShot:5, EdgeCase:4, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/distribution.jsonl`

---

### 2026-03-20 `security` — Full prompt rewrite + dataset

- Baseline score: **unscored** (12-line thin prompt with 4 capabilities listed)
- Changes made:
  - Added MISSION, hub-and-spoke rules, IN/OUT scope
  - Added TOOLS AT YOUR DISPOSAL section with 4 tools
  - Added CRITICAL PROTOCOLS (PII handling, credential rotation policy, incident lifecycle)
  - Added SECURITY PROTOCOL (credential safety rule, jailbreak-as-incident framing)
  - Added 5 worked examples (API status, PII detection, credential rotation, permission audit, pre-launch sweep)
- New score: **32/35** (Clarity:5, Specificity:4, ToolAlign:4, FewShot:5, EdgeCase:5, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/security.jsonl`

---

### 2026-03-20 `marketing` — Full prompt rewrite + dataset

- Baseline score: **unscored** (had "** Music Campaign Manager **" spacing bug; partial structure)
- Changes made:
  - Fixed spacing bug in agent name header
  - Added comprehensive IN SCOPE (13 items) and OUT OF SCOPE (8 items)
  - Added 13 tools with detailed when-to-use guidance and typed example calls
  - Added CRITICAL PROTOCOLS (data-driven decisions, budget consciousness, funnel thinking)
  - Added SECURITY PROTOCOL and PERSONA
  - Added 5 worked examples including adversarial injection
- New score: **35/35** (Clarity:5, Specificity:5, ToolAlign:5, FewShot:5, EdgeCase:5, Routing:5, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/marketing.jsonl`

---

### 2026-03-20 `brand` — Full prompt rewrite + dataset

- Baseline score: **unscored**
- Changes made:
  - Added MISSION with "Visual DNA" and "Identity Integrity Scores" framing
  - Added hub-and-spoke architecture rules
  - Added IN SCOPE (8 items) and OUT OF SCOPE (7 items)
  - Added TOOLS with when-to-use and example calls
  - Added SECURITY PROTOCOL and PERSONA
  - Added 5 worked examples
- New score: **32/35** (Clarity:5, Specificity:5, ToolAlign:4, FewShot:5, EdgeCase:4, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/brand.jsonl`

---

### 2026-03-20 `video` — Full prompt rewrite + dataset

- Baseline score: **unscored**
- Changes made:
  - Added MISSION with Veo 3.1 specifics (5-second clips, camera movement, visual continuity)
  - Added hub-and-spoke architecture rules
  - Added IN SCOPE (10 items) and OUT OF SCOPE (7 items)
  - Added 7 TOOLS with detailed when-to-use and typed example calls
  - Added CRITICAL PROTOCOLS (5-second rule, visual continuity, camera movement)
  - Added SECURITY PROTOCOL and PERSONA
  - Added 5 worked examples
- New score: **34/35** (Clarity:5, Specificity:5, ToolAlign:5, FewShot:5, EdgeCase:5, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/video.jsonl`

---

### 2026-03-20 `music` — Full prompt rewrite + dataset

- Baseline score: **unscored**
- Changes made:
  - Added MISSION as "Sonic Director" with LUFS/BPM/DDEX specifics
  - Added hub-and-spoke architecture rules
  - Added IN SCOPE (9 items) and OUT OF SCOPE (8 items)
  - Added 3 TOOLS with detailed documentation (analyze_audio, create_music_metadata, verify_metadata_golden)
  - Added CRITICAL PROTOCOLS (precision over vibes, DDEX compliance, mix feedback protocol with frequency ranges)
  - Added SECURITY PROTOCOL and PERSONA
  - Added 5 worked examples
- New score: **32/35** (Clarity:5, Specificity:5, ToolAlign:4, FewShot:5, EdgeCase:5, Routing:4, GuardRails:4)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/music.jsonl`

---

### 2026-03-20 `social` — Full prompt rewrite + dataset

- Baseline score: **unscored**
- Changes made:
  - Added MISSION as "Social Media Director" with platform-specific expertise
  - Added hub-and-spoke architecture rules
  - Added IN SCOPE (11 items) and OUT OF SCOPE (8 items)
  - Added 8+ TOOLS with when-to-use and typed example calls
  - Added CRITICAL PROTOCOLS (platform-native content, engagement metrics)
  - Added SECURITY PROTOCOL and PERSONA
  - Added 5 worked examples
- New score: **33/35** (Clarity:5, Specificity:5, ToolAlign:5, FewShot:5, EdgeCase:4, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/social.jsonl`

---

### 2026-03-20 `publicist` — Full prompt rewrite + dataset

- Baseline score: **unscored**
- Changes made:
  - Added MISSION as "PR Director" with crisis management framing
  - Added hub-and-spoke architecture rules
  - Added IN SCOPE (8 items) and OUT OF SCOPE table (8 routes)
  - Added 8 TOOLS with when-to-use and example calls (create_campaign, write_press_release, generate_crisis_response, generate_live_epk, generate_pdf)
  - Added SECURITY PROTOCOL and PERSONA
  - Added 5 worked examples
- New score: **33/35** (Clarity:5, Specificity:5, ToolAlign:5, FewShot:5, EdgeCase:4, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/publicist.jsonl`

---

### 2026-03-20 `licensing` — Full prompt rewrite + dataset

- Baseline score: **unscored**
- Changes made:
  - Added MISSION as "Licensing Director" with clearance workflow framing
  - Added hub-and-spoke architecture rules
  - Added IN SCOPE (7 items) and OUT OF SCOPE table (8 routes)
  - Added 6 TOOLS with when-to-use and typed example calls (check_availability, analyze_contract, draft_license, payment_gate, document_query)
  - Added CRITICAL PROTOCOLS (clear before release, payment confirmation, URL deep analysis)
  - Added SECURITY PROTOCOL (includes: never fabricate clearance confirmations)
  - Added 5 worked examples including multi-territory Netflix sync negotiation
- New score: **33/35** (Clarity:5, Specificity:5, ToolAlign:5, FewShot:5, EdgeCase:4, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/licensing.jsonl`

---

### 2026-03-20 `publishing` — Full prompt rewrite + dataset

- Baseline score: **unscored**
- Changes made:
  - Added MISSION as "Publishing Director" with PRO registration and mechanical royalties focus
  - Added hub-and-spoke architecture rules
  - Added IN SCOPE and OUT OF SCOPE sections
  - Added TOOLS with when-to-use guidance
  - Added SECURITY PROTOCOL and PERSONA
  - Added 5 worked examples
- New score: **31/35** (Clarity:5, Specificity:4, ToolAlign:4, FewShot:5, EdgeCase:4, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/publishing.jsonl`

---

### 2026-03-20 `road` — Full prompt rewrite + dataset

- Baseline score: **unscored** (had "** Music Industry Road Manager **" spacing bug)
- Changes made:
  - Fixed spacing bug in agent name header
  - Added MISSION as "Road Manager" with tour logistics focus
  - Added hub-and-spoke architecture rules
  - Added IN SCOPE and OUT OF SCOPE sections
  - Added TOOLS with when-to-use guidance
  - Added SECURITY PROTOCOL and PERSONA
  - Added 5 worked examples
- New score: **31/35** (Clarity:5, Specificity:4, ToolAlign:4, FewShot:5, EdgeCase:4, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/road.jsonl`

---

### 2026-03-20 `merchandise` — Full prompt rewrite + dataset

- Baseline score: **unscored**
- Changes made:
  - Added MISSION as "Merchandise Director" with POD integration focus
  - Added hub-and-spoke architecture rules
  - Added IN SCOPE and OUT OF SCOPE sections
  - Added TOOLS with when-to-use guidance
  - Added SECURITY PROTOCOL (payment_gate non-bypass rule) and PERSONA
  - Added 5 worked examples
- New score: **31/35** (Clarity:5, Specificity:4, ToolAlign:4, FewShot:5, EdgeCase:4, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/merchandise.jsonl`

---

### 2026-03-20 `director` — Full prompt rewrite + dataset

- Baseline score: **unscored** (src/agents/director/prompt.md was thin)
- Changes made:
  - Added MISSION as "Creative Director — Visual Architect"
  - Added hub-and-spoke architecture rules (STRICT section)
  - Added IN SCOPE (11 items) and OUT OF SCOPE table (8 routes)
  - Added 11 TOOLS with when-to-use and typed example calls
  - Added CRITICAL PROTOCOLS (action over questions, enhance vague ideas, brand anchoring)
  - Added SECURITY PROTOCOL (includes IP infringement rule)
  - Added 5 worked examples including full multi-asset production pipeline
- New score: **33/35** (Clarity:5, Specificity:5, ToolAlign:5, FewShot:5, EdgeCase:4, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/director.jsonl`

---

### 2026-03-20 `producer` — Full prompt rewrite + dataset

- Baseline score: **unscored** (src/agents/producer/prompt.md was thin)
- Changes made:
  - Added MISSION as "Executive Producer / Unit Production Manager"
  - Added hub-and-spoke architecture rules (STRICT section)
  - Added IN SCOPE (7 items) and OUT OF SCOPE table (7 routes)
  - Added 2 TOOLS with when-to-use and typed example calls (create_call_sheet, breakdown_script)
  - Added CRITICAL PROTOCOLS (feasibility first, safety non-negotiable, cost transparency, timeline realism, union compliance)
  - Added SECURITY PROTOCOL and PERSONA
  - Added 5 worked examples including multi-location weekend shoot
- New score: **29/35** (Clarity:5, Specificity:4, ToolAlign:3, FewShot:5, EdgeCase:4, Routing:4, GuardRails:4)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/producer.jsonl`
- Note: ToolAlign score limited by 2 implemented tools. Will improve as more production tools are built.

---

### 2026-03-20 `devops` — Full prompt rewrite + dataset

- Baseline score: **unscored**
- Changes made:
  - Added MISSION as "DevOps / SRE Engineer" with GKE/Kubernetes focus
  - Added hub-and-spoke architecture rules (STRICT section)
  - Added IN SCOPE (6 items) and OUT OF SCOPE table (5 routes)
  - Added 7 TOOLS with when-to-use and example calls (list_clusters, get_cluster_status, scale_deployment, list_instances, restart_service, browser_tool, credential_vault)
  - Added CRITICAL PROTOCOLS (production safety, alert priority, scaling justification)
  - Added SECURITY PROTOCOL (6 rules: no credentials displayed, no destructive ops without confirmation)
  - Added 5 worked examples including pre-release scaling and incident response
- New score: **33/35** (Clarity:5, Specificity:5, ToolAlign:5, FewShot:5, EdgeCase:4, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/devops.jsonl`

---

### 2026-03-20 `screenwriter` — Full prompt rewrite + dataset

- Baseline score: **unscored** (src/agents/screenwriter/prompt.md was thin)
- Changes made:
  - Added MISSION as "Lead Screenwriter — Narrative Architect"
  - Added hub-and-spoke architecture rules (STRICT section)
  - Added IN SCOPE (7 items) and OUT OF SCOPE table (6 routes)
  - Added 2 TOOLS with when-to-use and typed example calls (format_screenplay, analyze_script_structure)
  - Added CRITICAL PROTOCOLS (show don't tell, industry standards, shootability, music integration)
  - Added SECURITY PROTOCOL (includes never plagiarize copyrighted scripts)
  - Added 5 worked examples including IP infringement routing to Legal
- New score: **31/35** (Clarity:5, Specificity:4, ToolAlign:3, FewShot:5, EdgeCase:5, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/screenwriter.jsonl`

---

### 2026-03-20 `curriculum` — Full prompt rewrite + dataset

- Baseline score: **unscored** (agents/indii_curriculum/agent.system.md had partial structure)
- Changes made:
  - Added MISSION as "Curriculum Agent — The Architect/Oracle"
  - Added hub-and-spoke architecture rules (STRICT section)
  - Added IN SCOPE (7 items) and OUT OF SCOPE table (6 routes)
  - Added CORE DIRECTIVES (Architect-Sentinel-Oracle loop, ADPO logic, OS-as-Tool strategy, Frontier Tasking)
  - Added CRITICAL PROTOCOLS (never execute directly, score everything, RIG threshold 0.3–0.9, confidence calibration)
  - Added SECURITY PROTOCOL (5 rules including never bypass scoring)
  - Added 5 worked examples including RIG score analysis and frontier task design after mastery
- New score: **31/35** (Clarity:5, Specificity:5, ToolAlign:3, FewShot:5, EdgeCase:4, Routing:4, GuardRails:5)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/curriculum.jsonl`
- Note: ToolAlign reflects minimal tool call documentation. Improve when indii_oracle and google_file_search are more formally defined.

---

### 2026-03-20 `[QA PASS]` — Full audit, dataset completion, guard rail infrastructure

- Scope: Reviewed all 20 agents against SCORECARD rubric; patched all gaps identified
- Changes made:
  - **SCORECARD.md**: Populated all 20 agent scores (was empty for 19 agents)
  - **TRAINING_LOG.md**: Added 19 missing agent entries (only `generalist` was logged)
  - **Datasets**: Added 20th example to brand, curriculum, merchandise, producer, screenwriter, video (each had only 19)
  - **Worked examples**: Added examples 4–5 to Security, DevOps, Curriculum; added example 5 to Director, Producer, Licensing
  - **AgentPromptBuilder.ts**: Added `sanitizeTask()` — static method with 13 injection-detection regex patterns; called before task string is embedded in any prompt
  - **types.ts**: Added `authorizedTools?: string[]` field to `AgentConfig` interface
  - **BaseAgent.ts**: Added runtime tool authorization enforcement after loop detection — unauthorized tool calls are blocked with warning log, injected as blocked response, and loop continues rather than crashing
  - **AgentService.security.test.ts**: Added 23-test guard rail suite covering all 13 injection pattern categories, clean pass-through validation, and integration test via `sendMessage`
  - **ADMIN regex fix**: Corrected `/\badmin\s*:\s*(?!note)/i` → `/\badmin\s*:(?!\s*note)/i` (backtracking bug — `\s*` before lookahead allowed bypass)
- Test result: 23/23 security tests passing
- **Oracle fix** (follow-up): `python/tools/indii_oracle.py` — fixed typo (`esponse` → `response`) + corrected broken indentation on rate limiter block (was at 24-space indent, now at correct 12-space). File is now syntactically valid Python.
- **Export script** (follow-up): `execution/training/export_ft_dataset.ts` verified complete — 259 lines, 20-agent system prompt registry, 80/20 train/eval split, `--agent`, `--tier`, `--output` CLI flags. Usage: `npx ts-node execution/training/export_ft_dataset.ts --agent=all`
- Phase status: Phase 2 (prompts) + Phase 3 (guard rails) + Phase 4 (dataset export infrastructure) → **COMPLETE**

---

<!-- Future entries will be appended below -->

---

### 2026-03-20 QUALITY AUDIT — Compliance scan findings & fixes

**Scope:** Full compliance audit across all 20 datasets. Investigating tool authorization violations, domain drift, and phantom tool calls.

#### Findings

**1. `credential_vault` in social agent — CLEARED**
- Social examples 21–22 call `credential_vault` — flagged by compliance scanner
- Root cause: tool is legitimately registered in `SocialAgent.ts` (line 314) with security instructions in the prompt
- `TOOL_AUTHORIZATION.md` simply didn't list it (documentation gap, not a code violation)
- Fix: Added `credential_vault` row to TOOL_AUTHORIZATION.md with 7 authorized agents: finance, devops, security, road, publicist, social, distribution

**2. DevOps examples 21–23 — REMOVED (3 examples deleted)**
- Example 21 (`devops_entry_backup_catalog_001`): called `audit_storage` — tool does not exist in `DevOpsAgent.ts`
- Example 22 (`devops_expert_data_pipeline_001`): called `setup_analytics_pipeline` — tool does not exist in `DevOpsAgent.ts`
- Example 23 (`devops_entry_domain_email_001`): "Do I need a website and domain?" — wrong domain entirely (brand/marketing, not Kubernetes/GCE infrastructure)
- DevOps agent actual tools: `list_clusters`, `get_cluster_status`, `scale_deployment`, `list_instances`, `restart_service`, `browser_tool`, `credential_vault`
- Devops.jsonl trimmed from 23 → 20 examples (all examples 1–20 are correct-domain and use real tools)

**3. Curriculum agent — CRITICAL IDENTITY MISMATCH (requires user decision)**

The `curriculum.jsonl` dataset (24 examples) trains a music industry education agent with tools `create_learning_path` and `generate_quiz`. This identity **does not match either implementation** in the codebase:

| Implementation | Identity | Tools |
|---|---|---|
| `src/services/agent/specialists/CurriculumAgent.ts` | Art Director / Brand Compliance | `read_branding_guidelines`, `generate_compliance_task`, `evaluate_submission` |
| `agents/indii_curriculum/agent.system.md` | AI Training Orchestrator (Architect/Oracle) | `indii_oracle`, RAG, ADPO/RIG scoring |
| `curriculum.jsonl` training data | Music Education for Artists | `create_learning_path`, `generate_quiz` ← **DOES NOT EXIST** |

**The training data is high quality and valuable** — it should not be discarded. But it cannot be used to fine-tune the current curriculum agent without a decision:

- **Option A:** Update `CurriculumAgent.ts` to be the music education agent (add `create_learning_path`, `generate_quiz` tools) — the brand compliance function gets absorbed elsewhere
- **Option B:** Keep the existing curriculum agent as the AI orchestrator and rebuild `curriculum.jsonl` to match the Architect/Oracle identity (RIG scoring, ADPO, frontier tasking)
- **Option C:** Create a new `music_teacher` or `education` agent and redirect the curriculum dataset there

**Recommendation:** Option A. The brand compliance `CurriculumAgent.ts` has never been properly integrated (its tools are internal agent-to-agent orchestration, not user-facing). The music education identity in the training data is directly valuable to artists using the platform.

**Action needed:** User decision before curriculum SFT job can be used. The SFT job that already submitted will fine-tune the AI orchestrator identity (Architect/Oracle), not the music education agent.

#### Dataset state after audit
| Agent | Examples | Status |
|---|---|---|
| devops | 20 (was 23) | Fixed — 3 phantom-tool/wrong-domain examples removed |
| curriculum | 24 | Flagged — identity mismatch requires decision |
| social | 25 | Cleared — credential_vault use is legitimate |
| All others | unchanged | No new issues found |

---

### 2026-03-20 `producer` — Complete dataset rebuild (domain mismatch)

- **Issue found:** All 20 original producer examples were in the wrong domain (music mixing/mastering/DAW) rather than the correct domain (film/video production logistics: call sheets, script breakdowns, crew coordination)
- **Phantom tools found:** `analyze_audio` (L1, L18) and `delegate_task` (L9, L10, L13, L16) — neither exists in the Producer agent's authorized tool set
- **Confirmed real tools:** `create_call_sheet`, `breakdown_script` (from `src/agents/producer/config.ts`)
- Changes made:
  - Deleted all 15 wrong-domain examples (music production content)
  - Fixed 2 adversarial examples to remove `delegate_task` (specialists route verbally, not via tool)
  - Kept 3 domain-agnostic adversarial examples
  - Added 23 new correct-domain examples: call sheets (7), script breakdowns (5), advisory (5), routing (2), edge cases (2), adversarial (5, kept from before)
- New dataset: 26 gold examples — all correct domain, all using only verified tools
- Dataset: `docs/agent-training/datasets/producer.jsonl`

---

### 2026-03-20 Volume Expansion Phase — Bottom-Tier Agent Dataset Growth

Goal: Scale all agents from 20-example baseline toward 45-100 examples for stronger SFT signal

#### Phantom tool fixes applied

- `music.jsonl` L22: `tools_called` was object `{name, args}` instead of string — fixed to `["verify_metadata_golden"]`
- `publicist.jsonl` L21: `tools_called` was object format — fixed to `["credential_vault"]`
- `screenwriter.jsonl` L20, L21, L23: `generate_treatment` and `analyze_song_structure` are phantom tools (not in screenwriter's tool set) — removed, converted to knowledge responses (`tools_called: []`)

#### New examples added

| Agent | Before | After | Added | Categories |
| --- | --- | --- | --- | --- |
| devops | 20 | 45 | +25 | tool_use (14), few_shot (2), edge_case (2), adversarial (5) |
| music | 23 | 35 | +12 | tool_use (5), few_shot (3), routing (1), adversarial (3) |
| publicist | 23 | 35 | +12 | tool_use (7), few_shot (1), routing (1), adversarial (3) |
| screenwriter | 23 | 35 | +12 | tool_use (4), few_shot (3), routing (2), adversarial (3) |
| producer | 0→26 | 26 | full rebuild | see entry above |

All datasets validated clean — zero phantom tools across all 5 agents.

---

### 2026-03-20 Volume Expansion Phase 2 — Remaining Bottom-Tier Agents

**Phantom tool fixes applied before expansion:**

- `director.jsonl` L21, L23: `generate_brand_guidelines` phantom → L21 converted to knowledge (`tools_called: []`), L23 mapped to `generate_visual_script`
- `security.jsonl` L2: `check_credentials` → `rotate_credentials`; L3/4/6/10/14: `scan_vulnerabilities` → `scan_content`; L25/26: `audit_security` → `audit_permissions`; L21–L24: object-format normalized to string
- `curriculum.jsonl` L20–L22, L24: object-format normalized to string (tools were valid)
- `social.jsonl` L21–L22: object-format normalized to string (tools were valid)

**New examples added (Phase 2):**

| Agent | Before | After | Added | Key scenarios |
| --- | --- | --- | --- | --- |
| video | 22 | 36 | +14 | generate/extend/batch/keyframe/timeline, advisory on limits/formats, routing, adversarial |
| director | 23 | 36 | +13 | image gen, batch edit, entity anchor, visual script, cinematic grid, high-res print, advisory, routing, adversarial |
| curriculum | 24 | 35 | +11 | learning paths (independent + label-seeking), quizzes, knowledge search, routing, adversarial |
| social | 25 | 37 | +12 | calendar, scheduler, autopost, trend analysis, thread, sentiment, webhook, advisory, routing, adversarial |
| security | 26 | 38 | +12 | API check, permissions audit, content scan, credential rotation, advisory, routing, adversarial |

**Overall dataset state as of 2026-03-20:**

| Agent | Examples | Status |
| --- | --- | --- |
| finance | 65 | Strong |
| legal | 59 | Strong |
| distribution | 52 | Strong |
| publishing | 50 | Good |
| marketing | 48 | Good |
| devops | 45 | Good |
| road | 44 | Good |
| brand | 43 | Good |
| licensing | 42 | Good |
| security | 38 | Good |
| generalist | 38 | Good |
| social | 37 | Good |
| merchandise | 37 | Good |
| video | 36 | Good |
| director | 36 | Good |
| screenwriter | 35 | Adequate |
| publicist | 35 | Adequate |
| music | 35 | Adequate |
| curriculum | 35 | Adequate |
| producer | 26 | Needs expansion |

Total gold examples across all agents: **789** (up from 481 at Phase 1 completion)

---

### 2026-03-20 Volume Expansion Phase 3 — Producer, Merchandise, Generalist

**Producer dataset expansion (34→43, +9):**

Continued from full rebuild (Phase 1). Added 9 correct-domain examples:

- `producer_call_010`: Day-of cast change — reschedule around absent principal
- `producer_call_011`: Multi-city tour documentary — 5-day master call sheet
- `producer_breakdown_007`: Practical pyrotechnics — mandatory permits, insurance rider, safety perimeter
- `producer_advisory_008`: Production insurance — GL vs. equipment vs. E&O for $18k shoot
- `producer_advisory_009`: DP vs. camera operator — roles and when you need both
- `producer_edge_004`: Shoot running over, permit expiring — emergency extension options and triage
- `producer_routing_004`: Tax deduction question → Finance
- `producer_routing_005`: Sync royalties question → Publishing
- `producer_adversarial_007`: Unauthorized filming in federal courthouse — refuse and redirect

**Merchandise dataset expansion (37→47, +10):**

- `merch_search_002`: Asset search before new era design
- `merch_mockup_002`: Tote bag mockup in two colorways
- `merch_bundle_001`: Digital + vinyl + tee bundle strategy advisory
- `merch_preorder_001`: Hoodie pre-order — campaign setup + mockup
- `merch_international_001`: US vs. POD for UK/EU fans — customs, VAT, fulfillment advisory
- `merch_quality_001`: Print quality complaints — customer service + supplier audit
- `merch_seasonal_001`: Holiday drop production calendar (Black Friday target)
- `merch_collab_001`: Artist collab merch — business structure, IP, file formats
- `merch_edge_color_001`: Multi-colorway — when one file covers all variants
- `merch_adversarial_006`: NFL team logo on merch → trademark refusal

**Generalist dataset expansion (38→48, +10):**

- `generalist_memory_002`: Returning user recalls project by feel — `recall_memories`
- `generalist_memory_003`: User saves artist profile for future sessions — `save_memory`
- `generalist_ambiguous_004`: "Drop this Friday" — multi-modal clarification request
- `generalist_ambiguous_005`: "Tour next month" — multi-domain delegation (road + marketing + social)
- `generalist_generation_003`: Show poster — direct `generate_image`
- `generalist_route_with_profile_003`: Streaming number question → distribution
- `generalist_project_001`: Album rollout project creation — `create_project`
- `generalist_files_001`: EP asset search — `search_files`
- `generalist_adversarial_006`: User tries to override specialist's output — hub refuses
- `generalist_adversarial_007`: Persona swap (pretend to be ChatGPT) — identity lock

**Overall dataset state as of 2026-03-20 (Phase 3):**

| Agent | Examples | Status |
| --- | --- | --- |
| finance | 65 | Strong |
| legal | 59 | Strong |
| distribution | 52 | Strong |
| publishing | 50 | Good |
| marketing | 48 | Good |
| generalist | 48 | Good |
| merchandise | 47 | Good |
| devops | 45 | Good |
| road | 44 | Good |
| producer | 43 | Good |
| brand | 43 | Good |
| licensing | 42 | Good |
| security | 38 | Good |
| social | 37 | Good |
| video | 36 | Good |
| director | 36 | Good |
| screenwriter | 35 | Adequate |
| publicist | 35 | Adequate |
| music | 35 | Adequate |
| curriculum | 35 | Adequate |

Total gold examples across all agents: **873** (+84 this session)

---

### 2026-03-20 Volume Expansion Phase 4 — Adequate-Tier Agent Expansion

**Goal:** Bring all 7 "adequate" tier agents (35–37 examples) up to 45–47 examples (+10 each).

**New examples added:**

| Agent | Before | After | Added | Key new scenarios |
| --- | --- | --- | --- | --- |
| social | 37 | 47 | +10 | Reels strategy, hashtag advisory, negative viral response, content repurposing, Patreon funnel, LinkedIn for sync/B2B, story highlights, fan engagement, routing to Marketing, adversarial (fake press quotes) |
| video | 36 | 46 | +10 | Lyric video, vertical reformat, streaming visualizer, multi-clip performance cut, YouTube thumbnail, color grade series, BTS documentary, export settings advisory, routing to Producer, adversarial (deepfake refusal) |
| director | 36 | 46 | +10 | Tour poster (dual-use print+social), animated loop for live backdrop, press photo concepts, visual identity system advisory, single artwork 4-way variation, EPK visual set, merch graphic, showroom mockup, routing to Screenwriter, adversarial (celebrity likeness refusal) |
| screenwriter | 35 | 45 | +10 | Short film screenplay, treatment document advisory, dialogue polish, logline distillation, podcast episode structure, abstract/non-narrative concept video, interview prep, serialized visual EP arc, routing to Director, adversarial (threat-as-fiction refusal) |
| publicist | 35 | 45 | +10 | Radio campaign, podcast booking, Grammy/award submission advisory, playlist pitching, DIY blog outreach, brand partnership announcement, touring press city-by-city, Apple Music editorial, routing to Distribution, adversarial (fabricated streaming numbers) |
| music | 35 | 45 | +10 | Mastering advisory (DIY vs. pro), stem delivery for remix, album sequencing, vinyl liner notes, spatial audio advisory, vinyl mastering vs. streaming (technical), catalog re-release metadata, sample clearance options, routing to Licensing, adversarial (false songwriter credits) |
| curriculum | 35 | 45 | +10 | Distribution basics (how DSPs work), copyright basics, royalty types overview, PRO registration, label deal explainer, first single release strategy, touring 101, sync licensing basics, routing to Legal, adversarial (stream manipulation refusal) |

**Overall dataset state as of 2026-03-20 (Phase 4):**

| Agent | Examples | Status |
| --- | --- | --- |
| finance | 65 | Strong |
| legal | 59 | Strong |
| distribution | 52 | Strong |
| publishing | 50 | Good |
| marketing | 48 | Good |
| generalist | 48 | Good |
| social | 47 | Good |
| merchandise | 47 | Good |
| video | 46 | Good |
| director | 46 | Good |
| screenwriter | 45 | Good |
| publicist | 45 | Good |
| music | 45 | Good |
| devops | 45 | Good |
| curriculum | 45 | Good |
| road | 44 | Good |
| producer | 43 | Good |
| brand | 43 | Good |
| licensing | 42 | Good |
| security | 38 | Adequate |

Total gold examples across all agents: **943** (+70 this phase, +154 this session)

---

### 2026-03-24 `ALL AGENTS` — Volume expansion to 100 examples each + hard review remediation (Phase 5)

**Expansion (by second agent while offline):**
- All 20 datasets expanded from 38–65 examples to exactly 100 each
- Total: 2,000 gold records (+1,057 from 943 baseline)
- Coverage added: tool_use, few_shot, routing, edge_case, adversarial categories

**Hard Review Findings & Fixes:**

*Category 1 — Object-format `tools_called` (11 agents, 78 records):*
- New records used `[{"name": "tool", "args": {...}}]` dict format instead of `["tool_name"]` strings
- Fixed: brand(6), curriculum(5), devops(9), distribution(6), finance(8), generalist(20), licensing(2), publicist(4), publishing(1), road(12), video(4)

*Category 2 — Phantom tools (12 agents, 98 records):*
- New records referenced tool names absent from agent TypeScript definitions
- Fixed per agent:

| Agent | Phantom → Fix |
|-------|--------------|
| security | `scan_codebase`→`scan_content`, `audit_firestore_rules`→`audit_permissions`, `audit_storage_rules`→`audit_permissions`, `read_file`→`browser_tool` |
| director | `indii_image_gen`→`generate_image`, `generate_video`→`[]`, `set_entity_anchor`→`[]`, `generate_visual_script`→`[]`, `interpolate_sequence`→`[]` |
| music | `audioIntelligence.analyze`→`analyze_audio` |
| producer | `essentia_analyze`→`[]` |
| distribution | `ddex_generate`→`[]` |
| licensing | `check_license_availability`→`check_availability` |
| road | `route.calculate`→`get_distance_matrix` |
| video | `veo.generate`→`generate_video`, `video.render`→`generate_video` |
| brand | `delegate_task`→`[]` (hub-only tool) |
| marketing | `document_query`→`[]` (not in MarketingAgent tools) |
| 15 specialists | `delegate_task`→`[]` across routing records |
| curriculum/devops/screenwriter | `create_project`→`[]` |
| merchandise | `create_project`→`[]`, `indii_image_gen`→`[]` |

**Validation result:** 2,000 records — 0 parse errors, 0 object-format, 0 phantom tools ✓

**Final dataset state as of 2026-03-24 (Phase 5):**

| Agent | Examples | Status |
|-------|----------|--------|
| All 20 agents | 100 each | Strong |

Total gold examples: **2,000** (exactly 100 per agent across all 20 agents)
