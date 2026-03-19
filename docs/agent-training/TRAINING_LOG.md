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
