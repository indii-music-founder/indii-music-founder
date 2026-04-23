# indiiOS — Architectural Decisions

Each decision is numbered, dated, and locked unless explicitly re-opened. When a decision changes, append a superseding entry rather than editing the original — history matters.

---

## 1. Product positioning — AI-native music business platform (not creative platform)

- **Date:** 2026-04-23
- **Status:** locked
- **Context:** Prior documentation (CLAUDE.md and mirrors) described indiiOS as an "AI-native creative platform for independent music producers, visual artists, and creators." That framing confused the market boundary and invited comparisons with creative software (DAWs, design tools, content generators).
- **Decision:** indiiOS is a **music business platform** — "the first of its kind" — for independent music artists. The creative work (production, mixing, mastering) is the user's input, not the product's scope.
- **Consequences:**
  - All agent messaging, marketing copy, and investor pitch material must use "music business platform for independent artists"
  - Competitive positioning is against distributor + publishing admin + merch + CRM stacks — not against creative tools
  - "Creative platform" language is retired from all documentation

---

## 2. Scope boundary — pick up where mastering ends

- **Date:** 2026-04-23
- **Status:** locked
- **Context:** Creation and production tools are a crowded, commoditized market. Post-production business tooling for independent artists is not.
- **Decision:** indiiOS begins at mastered-audio ingestion. It does not ship DAW features, stem separation, mastering assistance, or any upstream creative functionality. Mastered audio is always the input.
- **Consequences:**
  - Feature requests that cross this line should be declined or deferred
  - Roadmap entries that imply creative-tool functionality are out of scope
  - Integrations prefer DSPs, distributors, PROs, rights registries, and publishing admin platforms — not DAWs or plug-in ecosystems

---

## 3. Target user — independent artists only (Robin Hood framing)

- **Date:** 2026-04-23
- **Status:** locked
- **Context:** The product exists to give independent artists access to capabilities that only well-funded major-label teams currently have.
- **Decision:** indiiOS is explicitly **not built for major artists, major labels, or major managers**. Target users are independent music artists regardless of genre or experience level — self-identification is the only gate.
- **Consequences:**
  - Feature requests that only make sense at label scale (A&R pipelines, advance accounting for signed rosters, multi-roster admin tooling) are declined or deferred
  - Pricing, UX affordances, and agent defaults assume a one-artist / small-team tenant — not a label with dozens of artists
  - Marketing does not pursue label partnerships as a primary channel

---

## 4. Hub-and-spoke agent topology over swarm

- **Date:** pre-existing
- **Status:** locked
- **Context:** indiiOS has 21 domain-specialized agents ("departments") — legal, finance, distribution, publishing, marketing, merchandise, social, road, publicist, brand, creative, video, licensing, music, analytics, and so on.
- **Decision:** A single Conductor (`generalist` agent) routes every task to a specialist based on intent + module context. Specialists do not free-form negotiate with each other.
- **Consequences:**
  - Deterministic routing is testable; emergent multi-agent behavior is not
  - Each specialist carries a focused system prompt and filtered tool pool (via `ToolPoolAssembler`)
  - Token cost per task is predictable
  - Tradeoff: less emergent behavior than a swarm would produce; harder for agents to spontaneously collaborate outside pre-defined delegation channels

---

## 5. Zustand as the primary state manager (Redux Toolkit legacy)

- **Date:** pre-existing
- **Status:** locked
- **Context:** User chose Zustand with assistance; Redux Toolkit 2.11.2 remains for some legacy slices.
- **Decision:** New state goes into Zustand at `packages/renderer/src/core/store/slices/*`. Legacy Redux slices migrate opportunistically.
- **Consequences:**
  - 23 domain slices under the Zustand root store
  - Cross-slice coordination uses `useShallow` from `zustand/react/shallow` to prevent unnecessary re-renders
  - Persistence layer: `SecureZustandStorage` adapter with Firestore + OS keychain for sensitive state
  - Tradeoff: two state systems coexist; migration is ongoing, not urgent

---

## 6. All-Google backend (Firebase, Gemini, Vertex AI, GEAP, BigQuery)

- **Date:** pre-existing
- **Status:** locked
- **Context:** Rather than mix vendors (Supabase + OpenAI + AWS), the user is standardizing on Google's stack.
- **Decision:** Firebase for auth / Firestore / Functions / Storage / Hosting; Gemini + Vertex AI for inference; BigQuery for revenue analytics; Gemini Enterprise Agent Platform (GEAP) for agent governance as phases roll out.
- **Consequences:**
  - Single vendor governance surface — one set of IAM, billing, and rules to reason about
  - Easier GEAP adoption as phases ship (Phase 1 Agent Identity already live)
  - Deeper Gemini / Genkit integration than a provider-neutral stack would allow
  - Tradeoff: vendor lock-in. Mitigated in practice because the creative and business layers above Firebase are vendor-agnostic TypeScript.

---

## 7. Electron desktop for vault-grade security

- **Date:** pre-existing
- **Status:** locked
- **Context:** User's framing: "security of having essentially a vault for user data but secure. This is a music industry app so essentially that's a feature, minimally a selling point."
- **Decision:** Ship indiiOS as an Electron desktop app in addition to the web build. Desktop is the canonical distribution; web is a reduced-capability companion.
- **Consequences:**
  - Masters, distributor API keys, SFTP credentials, OAuth tokens, and artist contracts live in OS keychain (keytar) + local encrypted store
  - SFTP distribution only works in desktop build — web tier returns a hard error at `packages/renderer/src/services/distribution/DeliveryService.ts:315`
  - Electron runs with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and `setContentProtection(true)` on sensitive windows
  - Tradeoff: larger install footprint, per-platform code signing (DMG / NSIS / AppImage), but materially stronger security story for music-industry buyers

---

## 8. DDEX ERN as the distribution source of truth

- **Date:** pre-existing
- **Status:** locked
- **Decision:** All 7 distributor adapters consume a canonical ERN object generated by `ERNService.generateERN()` + `ERNMapper.mapMetadataToERN()`. Metadata enrichment happens once; transmission to each DSP uses the distributor's required envelope but the same ERN core.
- **Consequences:**
  - New distributors only need an envelope adapter, not a full metadata pipeline
  - Validation (`ERNValidator`) runs before transmission, catching structural issues at a single checkpoint
  - YouTube Content ID uses the DDEX YouTube extension
  - ISRC / UPC auto-assignment centralizes identifier management

---

## 9. Python sidecar for tool execution (localhost:50080)

- **Date:** pre-existing
- **Status:** locked
- **Context:** Arbitrary code execution does not belong in the Electron main process — security, crash isolation, and language-ecosystem reasons all argue against it.
- **Decision:** A Docker Compose sidecar (`indii-agent`) runs 92 custom Python tools with an MCP protocol interface. The renderer talks to it over HTTP at `localhost:50080`; the main process spawns and monitors it via `python-bridge.ts`.
- **Consequences:**
  - Tools can use the full Python ecosystem without bloating the Electron build
  - Code-execution tool is gated behind `destructive` risk tier + explicit user approval
  - Health-checked every 30 s; auto-restarts up to 3 times on failure
  - Sensitive args redacted in logs (`--password`, `--key`, `--api-key`, `--token`)

---

## 10. Platinum Quality Standards are non-negotiable for every diff

- **Date:** 2026-04-18 (stupefied-faraday incident)
- **Status:** locked
- **Context:** A regression event established that ad-hoc code review was insufficient. Source: user feedback memory — *"Platinum review depth expected: verbatim diffs, file:line, pitfalls, commit plans, and verification steps on every review."*
- **Decision:** Every substantive PR must pass the `/plat` pre-flight before push. The Error Ledger (`.agent/skills/error_memory/ERROR_LEDGER.md`) must be consulted before debugging any reported bug. Violations of the Seven Anti-Patterns (`docs/PLATINUM_QUALITY_STANDARDS.md`) block merge.
- **Consequences:**
  - All agents working on the repo must read `docs/PLATINUM_QUALITY_STANDARDS.md` before editing
  - Error memory is the first lookup on any bug report, not the last
  - Skipping `/plat` is treated as equivalent to skipping the Error Ledger — protocol violation

---

## 11. Live browser QA via Google Antigravity; Playwright for CI

- **Date:** 2026-04-23 (user confirmed this turn)
- **Status:** locked
- **Context:** Headless Playwright is fast enough for CI but misses visual and interaction issues that only surface in a real rendering environment.
- **Decision:** Pre-demo and pre-release QA uses Google Antigravity for live browser observation. CI remains on Playwright (chromium only, `e2e/` directory, 1 worker) for speed and reproducibility.
- **Consequences:**
  - Antigravity is an interactive tool, not a CI runner — it does not replace Playwright
  - Critical investor-facing flows (founders checkout, distribution setup, release wizard) should be verified in Antigravity before a public build
  - `/auto_qa` skill coordinates screenshot-based visual regression separately
