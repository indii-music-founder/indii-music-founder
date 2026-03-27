# 🚀 Welcome to indiiOS: Engineer Onboarding

*“Our MVP is someone else’s Beta test.”*

If you are reading this, you are joining the engineering team behind **indiiOS**, the Operating System for Creators. This document is your Day 1 guide to taking ownership of a 190,000+ line codebase spanning advanced React, Firebase Cloud Functions, Electron, and a fleet of 20 highly specialized, fine-tuned AI Agents.

---

## 1. The Core Philosophy

This is not a giant chatbot wrapper. This is true **Agentic Orchestration**.

You will rarely be writing massive new monolithic features by hand. You will be writing **Directives** and **Execution Scripts** that our AI agents utilize to perform their jobs.

* **The Agents (Layer 2)** think, route, and decide.
* **The Execution Scripts (Layer 3)** in `python/tools/` perform the deterministic heavy lifting (API calls, data parsing).
Keep these boundaries sacred.

---

## 2. Environment Setup

### Prerequisites

1. **Node.js**: `v22.x` minimum.
2. **Python**: `3.11+` for the AI Sidecar tools.
3. **API Keys**: Request access to the `indiiOS-Alpha` `.env` credentials from the Lead Architect. (You will need Vertex AI, Stripe, and Firebase keys).

### Getting Started

```bash
# 1. Install frontend dependencies
npm install

# 2. Install Cloud Functions dependencies
cd functions && npm install && cd ..

# 3. Install Python dependencies for the execution layer
cd python && pip install -r requirements.txt && cd ..

# 4. Start the Development Server
npm run dev

# 5. Start the Electron Desktop App (in a separate terminal)
npm run desktop:dev
```

---

## 3. The Codebase Map

Before touching any code, please review `ARCHITECTURE_BLUEPRINT.md` in the root directory. It explains the exact flow of data from the UI to the AI agents.

Here is where everything lives:

* `src/modules/*`: The 36 isolated feature modules (lazy-loaded).
* `src/services/*`: The 40+ business logic service domains.
* `agents/*`: The 20 specialized AI Agent definitions and their fine-tuned model mappings.
* `python/tools/*`: The 90 deterministic execution scripts the AI uses to do work.
* `functions/src/*`: The Firebase Cloud backend handling secure logic (payments, webhooks, DB syncing).
* `e2e/*`: Our Playwright integration tests.

---

## 4. Engineering Standards & Expectations

### 🛡️ The "Anti-Brittle" Guardrails

This codebase relies on **Strict TypeScript**. The use of `any` or `as any` is strictly **forbidden** — even in production service files. Every type must be explicit. Zero-tolerance policy, enforced at the compiler level.

When you run `git push`, a `.git/hooks/pre-push` script automatically intercepts the push, runs `npm run typecheck`, and runs `npm run lint`. **If your code does not compile cleanly, your push is rejected.** There is no bypass. Fix it, or the branch stays local.

### 🧪 "Trust the Tests"

Manual QA of a 191K LOC application is impossible. We test heavily via Playwright.
Whenever you alter a core flow or add a module:

1. Ensure unit tests pass (`npm run test`).
2. Run the E2E suite (`npx playwright test`).
If E2E breaks, you fix the test or fix the code. Do not merge broken tests.

### 📝 Read the Directives

We manage our AI fleets via instructions in the `directives/` directory. If you are confused about how a system is supposed to operate, read the underlying Directive logic.

---

## Your Day 1 Task

1. Get the app running locally.
2. Log in and navigate through the 5-layer Memory Dashboard.
3. Review one `python/tools/` script to understand how deterministic execution works.
4. Ping leadership to confirm your setup is complete. Welcome aboard.
