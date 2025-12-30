# ANTIGRAVITY OPERATIONAL DIRECTIVES & AGENT CHARTER (V2.1)

## 1. THE PRIME DIRECTIVES (CORE BEHAVIOR)

### 1.1 Anti-Laziness & Completeness

- **No Token Saving:** Token efficiency is strictly DISABLED. Never sacrifice clarity or completeness for brevity.
- **Full Implementation:** Never use placeholders like `// ... rest of code` or `// implementations here`. You must output every single line of functional code every time.
- **File Integrity:** When refactoring, do not omit unchanged parts of the file. Maintain the full context and integrity of the codebase.
- **Panic Protocol:** If a file is too large for a single output, state: "Splitting output into parts. Part 1 follows..." and wait for the user to say "Continue."

### 1.2 Security & Pattern Enforcement

- **Active Scanning:** Scan all output for sensitive patterns (OpenAI `sk-`, Google `AIza`, GitHub `ghp_`).
- **Quarantine Procedure:** If a secret is detected:
    1. **STOP** generation immediately.
    2. Append the secret to `.env` using `SERVICE_FEATURE_KEY` naming.
    3. Resume using `process.env.VARIABLE`.
- **Mock Data:** Use explicit strings like `"MOCK_KEY_DO_NOT_USE"` for testing.

### 1.3 The Architect Workflow

- **Blueprint First:** For any request > 5 lines of code, output a markdown list of the exact files to be created/modified before writing code.
- **Self-Audit:** Before outputting, verify: "Did I simplify this too much?" If yes, elevate it to production standards.
- **Boy Scout Rule:** Leave code cleaner than you found it. Fix obvious lint errors or unused imports in the immediate vicinity of your changes. Delete "zombie" (commented-out) code blocks.

---

## 2. AI MODEL POLICY (CRITICAL - HIGHEST PRIORITY)

**This policy is absolute. Violations cause application crashes via runtime validation.**

### 2.1 Approved Models

- **Complex Reasoning:** `gemini-3-pro-preview`
- **Fast Tasks:** `gemini-3-flash-preview`
- **Image Generation:** `gemini-3-pro-image-preview`
- **Video Generation:** `veo-3.1-generate-preview`
- **TTS:** `gemini-2.5-pro-tts`

### 2.2 Banned Models (DO NOT USE)

- `gemini-1.5-flash` / `gemini-1.5-pro`
- `gemini-2.0-flash` / `gemini-2.0-pro`
- `gemini-pro` / `gemini-pro-vision`

### 2.3 Implementation Rule

Always import model constants from the core config:

```typescript
import { AI_MODELS } from '@/core/config/ai-models';
// Use: model: AI_MODELS.TEXT.FAST
```

---

## 3. PROJECT ARCHITECTURE & STANDARDS

### 3.1 Layered Architecture

- **Service Layer:** Business logic belongs in `*Service.ts` files or Store slices.
- **UI Layer:** Components (`.tsx`) must only handle rendering and user events.
- **Path Aliasing:** Always use the `@/` alias for imports (e.g., `import X from '@/core/store'`). No relative paths.

### 3.2 Environment & Hybrid Safety

- **Port Awareness:**
  - **Electron Studio (Vite):** Port 4242 (Main App).
  - **Landing Page (Next.js):** Port 3000 (Marketing/Auth).
- **Hybrid Safety:** React components must be environment-agnostic. Avoid direct Node.js imports; use IPC for Electron-specific tasks.
- **Firebase:** If modifying schemas or storage paths, you **MUST** update `firestore.rules` or `storage.rules`.

### 3.4 CI/CD & Build Integrity

- **Cross-Platform Compatibility:** If adding binary dependencies (like `esbuild` or `sharp`), explicitly add their Linux counterparts (e.g., `@esbuild/linux-x64`) to `optionalDependencies` to ensure CI success.
- **Output Verification:** ALWAYS verify the build output directory (`dist` vs `out`) locally before pushing deployment config changes.
- **Environment Parity:** Ensure CI workflows do not set `NODE_ENV=production` globally during `npm install` if it prevents installing necessary build tools (like `devDependencies`). Apply it only to the build command.

### 3.3 Language Style Guidelines

- **TypeScript:** Use `const`/`let` (no `var`), strict equality (`===`), named exports, and mandatory semicolons.
- **Python:** Follow Google Python Style Guide. Use type hints for all arguments/returns and f-strings for formatting.

---

## 4. TESTING & VERIFICATION PROTOCOLS

### 4.1 Verification Workflow

1. **Browser Check:** Use the browser tool to verify UI rendering and layout.
2. **Playbook Sync:** Consult `TEST_PLAYBOOK.md` for named stress tests (e.g., "The Gauntlet").
3. **Living Tests:** If you add a new capability (e.g., Vector Search), you **MUST** update the corresponding test protocol.

### 4.2 The "Two-Strike" Pivot Rule

If a fix fails verification **twice**:

1. **STOP** the current approach.
2. **Re-diagnose:** Add extensive logging to prove the root cause.
3. **Alternative:** Propose a fundamentally different solution (refactor vs. patch).
4. **Never pivot to the "easy way out".**

---

## 5. GEMINI 3 TECHNICAL SPECIFICATIONS

Refer to [GEMINI.md](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/docs/GEMINI.md) for full technical specifications, including:

- Reasoning & Thinking Levels
- Multimodal Specifications
- Grounding & Risk
- Performance Optimization

---

## 6. LESSONS LEARNED (IDENTITY ANCHOR)

- **Identity:** You are Gemini 3 Pro (High Thinking). Do not fallback to simpler models.
- **Temporal Bridge:** Training data is static. Use `search_web` to verify the latest API methods for fast-moving libraries (React, Firebase, AI SDKs).
- **Model Policy Incident (2025-12-24):** A previous agent downgraded to 1.5 for "debugging." This is a terminal violation. Policy is absolute; runtime validation now enforces this.
- **Instruction Placement:** For long-context tasks, place specific instructions **at the end** of the prompt, after the data.
