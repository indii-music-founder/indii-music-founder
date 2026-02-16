# Antigravity & Nano Banana Pro: Advanced Agentic Workflow Standards

This document outlines the high-level engineering and architectural patterns demonstrated in the "Antigravity" and "Nano Banana Pro" workflow. These standards represent the advanced skill level and capabilities expected in this project's development.

## 1. Asynchronous "Meta-Agent" Orchestration

Antigravity acts as a specialized developer peer rather than a simple chatbot.

* **Iterative Planning:** We generate implementation plans, review them, and adapt strategy based on user injection of comments (e.g., "skip tests", "use specific plugin").
* **Policy Management:** We operate under specific review policies ("Request Review", "Agent Decides", "Always Proceed") suitable for the environment.
* **Self-Correction:** We act semi-autonomously to analyze output, detect omissions (like missing links), and remediate without explicit error reports.

## 2. Distributed Tooling via Model Context Protocol (MCP)

We decouple "tools" from "agents" using MCP servers.

* **Separation of Concerns:** Specialized MCP servers (e.g., Media, Database) handle complexity, allowing agents to consume them as abstracted tools.
* **Connection Pooling & Security:** MCP servers handle resource efficiency and access control, preventing direct unmanaged access.

## 3. Advanced Multi-Modal Reasoning & Content Synthesis

We leverage high-capability models (e.g., Gemini 3 Pro class) for complex reasoning.

* **Text-Rich Image Generation:** Generating precision assets (infographics, slides) with accurate text rendering.
* **Search-Augmented Generation:** Fetching external data to fill knowledge gaps before synthesis.

## 4. Autonomous User Interface Testing

We utilize autonomous browser control for validation.

* **DOM Analysis:** Analyzing live DOMs to identify interactive elements.
* **Error Recovery:** Handling "flaky" UI states with intelligent retry logic and navigation.

## 5. Production-Ready Infrastructure Automation

We automate the transition from prototype to production.

* **Infrastructure as Code (IaC):** Generating Deploy stacks (Terraform, Docker) for immediate deployment (e.g., Cloud Run).
* **Session State Management:** Using managed services (e.g., Vertex AI Agent Engine) for robust, long-term session history.

---

## 6. The "Upgrade" Protocol (Standardization)

We have transitioned to the **Gemini 3** platform and **Native File Search RAG**.

* **Model Policy**: strictly adhere to `src/core/config/ai-models.ts`. Only Gemini 3 preview models are allowed. Usage of legacy models (1.5, 2.0) is a protocol violation.
* **Native RAG**: For document retrieval, use the **Gemini File Search API** or **Files API** (Long Context) via `GeminiRetrievalService`. Abandon legacy Semantic Retriever (Corpus/AQA) patterns.
* **Response Handling**: Always use `res.text()` (method) for Google AI SDK responses.

## 7. Standardized Verification (The Gauntlet)

For complex multi-agent or multi-step logic, we use the **"Gauntlet"** protocol.

* **Blueprint First**: Any architectural change or implementation > 5 lines requires a formal `implementation_plan.md` first.
* **Autonomous E2E**: Leverage the autonomous browser tool to verify UI/UX flows in real-time.
* **Stress Testing**: Run named stress tests (e.g., File Search Stress Test) for new features.

## 8. Tiered Context Awareness

Agents must respect user membership tiers and quotas.

* **Limit Checks**: Before high-resource operations (Video/Image gen, heavy RAG), query `MembershipService` to ensure current usage is within quota.
* **Graceful Degradation**: If limits are reached, provide actionable feedback or upgrade paths rather than generic errors.

## 9. Multi-Modal Reasoning Guidelines

Select the appropriate model level based on complexity.

* **High Thinking (Pro)**: Use `gemini-3-pro-preview` for strategy, architectural planning, and complex synthesis.
* **Fast Execution (Flash)**: Use `gemini-3-flash-preview` for specialized tasks, high-speed code generation, and single-responsibility sub-tasks.

---

## Compliance Status

**Last Verified:** 2025-12-26

| Section | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| 6 | Gemini 3 models only | ✅ PASS | `ai-models.ts` enforces policy |
| 6 | Native File Search RAG | ✅ PASS | `GeminiRetrievalService` implements Files API |
| 6 | Response handling (.text()) | ✅ PASS | All services use method call |
| 7 | Blueprint-first protocol | ⚠️ PARTIAL | Docs exist, hook not enforced |
| 7 | Gauntlet verification suite | ✅ PASS | `scripts/run-gauntlet.sh` |
| 7 | Stress tests | ✅ PASS | `e2e/file-search-stress.spec.ts` |
| 8 | Quota pre-checks | ✅ PASS | Integrated in Image/Video/RAG services |
| 8 | Graceful degradation | ✅ PASS | `QuotaExceededError` with upgrade prompts |
| 8 | MembershipService integration | ✅ PASS | Usage tracking in Firestore |
| Video | Scene Extension (60s+) | ✅ PASS | `SceneExtensionService` with Veo 3.1 |
| Video | First/Last Frame Control | ✅ PASS | Enhanced `VideoService` options |
| Video | Reference Images (3 max) | ✅ PASS | Veo 3.1 referenceImages support |
| Video | Native Audio Generation | ✅ PASS | `generateAudio` toggle |
| Video | Zoomable Timeline | ✅ PASS | `ZoomableTimeline` component |

**Key Files:**
- `src/services/MembershipService.ts` - Quota tracking & enforcement
- `src/shared/types/errors.ts` - QuotaExceededError class
- `scripts/run-gauntlet.sh` - Verification runner
- `docs/development/GAUNTLET_PROTOCOL.md` - Verification docs
- `src/services/video/SceneExtensionService.ts` - 60s+ video scene chaining
- `src/services/video/VideoService.ts` - Enhanced with Veo 3.1 features
- `src/modules/video/store/videoEditorStore.ts` - Extended video state
- `src/modules/video/components/ZoomableTimeline.tsx` - Timeline zoom UI

---

**Philosophy:**
The relationship is analogous to a **General Contractor** (User) hiring a **Specialized Architect** (Antigravity). The User reviews capabilities and sets safety regulations, while the Architect designs and coordinates specialized sub-contractors (MCP Servers) to execute the work.
