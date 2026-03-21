# Tool Authorization Matrix

This matrix defines which agents are authorized to call which tools.
Authorization is enforced at two levels:
1. **Prompt level** — the tool is not listed in the agent's TOOLS section
2. **Code level** — `registry.ts` enforces tool access per agent ID at runtime (TODO: implement enforcement)

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Authorized — tool is listed in agent's prompt and accessible |
| 🔒 | Hub only — only `generalist` (Agent Zero) may call this |
| ❌ | Blocked — agent must not call; route to authorized agent instead |
| 📖 | Read-only — agent can query but not mutate |

---

## Core Orchestration Tools

| Tool | generalist | finance | legal | distribution | marketing | brand | video | music | social | publicist | licensing | publishing | road | merchandise | director | producer | security | devops | screenwriter | curriculum |
|------|-----------|---------|-------|-------------|-----------|-------|-------|-------|--------|-----------|-----------|------------|------|-------------|----------|----------|----------|--------|-------------|------------|
| `delegate_task` | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `request_approval` | 🔒 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `save_memory` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `recall_memories` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `search_knowledge` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `verify_output` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Media Generation Tools

| Tool | generalist | finance | legal | distribution | marketing | brand | video | music | social | publicist | licensing | publishing | road | merchandise | director | producer | security | devops | screenwriter | curriculum |
|------|-----------|---------|-------|-------------|-----------|-------|-------|-------|--------|-----------|-----------|------------|------|-------------|----------|----------|----------|--------|-------------|------------|
| `generate_image` | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `generate_video` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `batch_edit_images` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `generate_audio` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Finance Tools

| Tool | generalist | finance | legal | distribution | marketing | brand | video | music | social | publicist | licensing | publishing | road | merchandise | director | producer | security | devops | screenwriter | curriculum |
|------|-----------|---------|-------|-------------|-----------|-------|-------|-------|--------|-----------|-----------|------------|------|-------------|----------|----------|----------|--------|-------------|------------|
| `analyze_budget` | 📖 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `calculate_royalty_waterfall` | 📖 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `audit_metadata` | 📖 | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `analyze_receipt` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Legal & Rights Tools

| Tool | generalist | finance | legal | distribution | marketing | brand | video | music | social | publicist | licensing | publishing | road | merchandise | director | producer | security | devops | screenwriter | curriculum |
|------|-----------|---------|-------|-------------|-----------|-------|-------|-------|--------|-----------|-----------|------------|------|-------------|----------|----------|----------|--------|-------------|------------|
| `analyze_contract` | 📖 | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `generate_split_sheet` | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `sample_clearance` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `copyright_registration` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Distribution Tools

| Tool | generalist | finance | legal | distribution | marketing | brand | video | music | social | publicist | licensing | publishing | road | merchandise | director | producer | security | devops | screenwriter | curriculum |
|------|-----------|---------|-------|-------------|-----------|-------|-------|-------|--------|-----------|-----------|------------|------|-------------|----------|----------|----------|--------|-------------|------------|
| `issue_ddex_package` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `assign_isrc` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `validate_audio_quality` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `sftp_upload` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Social & Marketing Tools

| Tool | generalist | finance | legal | distribution | marketing | brand | video | music | social | publicist | licensing | publishing | road | merchandise | director | producer | security | devops | screenwriter | curriculum |
|------|-----------|---------|-------|-------------|-----------|-------|-------|-------|--------|-----------|-----------|------------|------|-------------|----------|----------|----------|--------|-------------|------------|
| `generate_social_post` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `generate_press_release` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `pitch_playlist` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `schedule_social_post` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Audio Tools

| Tool | generalist | finance | legal | distribution | marketing | brand | video | music | social | publicist | licensing | publishing | road | merchandise | director | producer | security | devops | screenwriter | curriculum |
|------|-----------|---------|-------|-------------|-----------|-------|-------|-------|--------|-----------|-----------|------------|------|-------------|----------|----------|----------|--------|-------------|------------|
| `analyze_audio` | 📖 | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `detect_bpm_key` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `loudness_normalize` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Project & Infrastructure Tools

| Tool | generalist | finance | legal | distribution | marketing | brand | video | music | social | publicist | licensing | publishing | road | merchandise | director | producer | security | devops | screenwriter | curriculum |
|------|-----------|---------|-------|-------------|-----------|-------|-------|-------|--------|-----------|-----------|------------|------|-------------|----------|----------|----------|--------|-------------|------------|
| `create_project` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `list_projects` | ✅ | 📖 | 📖 | 📖 | 📖 | 📖 | 📖 | 📖 | 📖 | 📖 | 📖 | 📖 | 📖 | 📖 | 📖 | 📖 | ❌ | ❌ | 📖 | ✅ |
| `list_files` | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `vulnerability_scan` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `deploy_service` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 📖 | ✅ | ❌ | ❌ |
| `credential_vault` | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |

> **`credential_vault` scope:** Authorized only for agents that need to authenticate with external services (social platform APIs, payment processors, cloud credentials, distributor SFTP). Security enforced at two layers: (1) only registered in authorized agent's `functionDeclarations`, (2) all agents receiving credentials must NEVER echo them to the user — retrieve silently, use internally only.

---

## Enforcement Status (updated 2026-03-20)

- [x] Add `authorizedTools?: string[]` field to `AgentConfig` type → `src/services/agent/types.ts` line 294
- [x] Store `authorizedTools` in `BaseAgent` constructor → `src/services/agent/BaseAgent.ts` (property `protected authorizedTools`)
- [x] Block unauthorized tool calls at runtime → `BaseAgent.ts` — enforcement block after loop detection uses `this.tools.flatMap(...)` to build declared set; blocked calls are logged with `logger.warn` and returned as `{ success: false, error: ... }` to the LLM conversation
- [x] Log unauthorized attempts → `[BaseAgent] SECURITY: Agent '{id}' attempted unauthorized tool call: '{name}'` via `logger.warn`
- [ ] Populate `authorizedTools` explicitly in each agent definition (currently relies on `functionDeclarations` inference — adequate for now, hardcode when fine-tuning begins)
- [ ] Automated test: verify blocked tool call returns correct error structure (add to `AgentService.security.test.ts`)
