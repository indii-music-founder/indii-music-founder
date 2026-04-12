# 📘 indiiOS Scripts Catalog

This directory contains automation, diagnostics, and utility scripts for the indiiOS development ecosystem.

## 🚀 Core & Health

| Script | Command | Purpose |
| :--- | :--- | :--- |
| **doctor.sh** | `npm run doctor` | **Flagship.** Checks Node, Python, Dependencies, Git, .env, and Sidecar health. |
| **env-guardian.sh** | `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Clean/scripts/env-guardian.sh` | Backs up and restores `.env` from a secure location outside the repo. |
| **setup-dev-environment.sh** | N/A | Full machine bootstrapping for new developers. |
| **validate-env.ts** | `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Clean/scripts/validate-env.ts` | Zod-powered validation of `.env` against the required schema. |

## 🛠 Diagnostics & AI

| Script | Command | Purpose |
| :--- | :--- | :--- |
| **diagnose-stuck-agent.sh** | `scripts/diagnose-stuck-agent.sh` | Use when the indii Conductor is unresponsive or looping. |
| **the-auditor.ts** | `the-auditor.ts` | Deep audit of Firebase Storage and Auth state. |
| **diagnose-gemini-models.ts** | `diagnose-gemini-models.ts` | Verifies and lists available Gemini 3.0/2.5 models. |
| **list-vertex-models.ts** | `list-vertex-models.ts` | Lists GCP Vertex AI models and regions. |

## 🏗 Build & Infrastructure

| Script | Command | Purpose |
| :--- | :--- | :--- |
| **build_sidecar.sh** | `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Clean/scripts/build_sidecar.sh` | Rebuilds the Python AI sidecar Docker image. |
| **deploy-staging.sh** | `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Clean/scripts/deploy-staging.sh` | One-click deployment to the staging environment. |
| **start-proxy.ts** | `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Clean/scripts/start-proxy.ts` | Starts the local RAG proxy server for development. |

## 💾 Data & Seed

| Script | Command | Purpose |
| :--- | :--- | :--- |
| **seed-test-account.ts** | `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Clean/scripts/seed-test-account.ts` | populates Firestore with a complete "Platinum Release" mock artist profile. |
| **bulk-ingest-rag.ts** | `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Clean/scripts/bulk-ingest-rag.ts` | Ingests documentation into the RAG vector database. |
| **seed-earnings.ts** | `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Clean/scripts/seed-earnings.ts` | Generates mock financial data for the Revenue Dashboard. |

## 🧪 Verification & Stress Tests

| Script | Command | Purpose |
| :--- | :--- | :--- |
| **stress-test-rag.ts** | `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Clean/scripts/stress-test-rag.ts` | Evaluates RAG performance under high concurrent load. |
| **verify-gemini-image-gen.ts** | `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Clean/scripts/verify-gemini-image-gen.ts` | End-to-end verification of the image generation pipeline. |
| **test-chunker.ts** | `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Clean/scripts/test-chunker.ts` | Verifies the logic of the audio/text content chunking. |

---

## ⚡ npm Convenience Scripts

These are the DX power-user shortcuts available via `npm run <name>`:

| Script | Command | Purpose |
| :--- | :--- | :--- |
| **clean** | `npm run clean` | Wipe all build artifacts (dist, coverage, test-results, playwright-report). |
| **validate** | `npm run validate` | Full pre-push quality gate: typecheck → lint → test (all in one). |
| **nuke** | `npm run nuke` | Scorched-earth reinstall: rm node_modules + dist → npm install. |
| **bootstrap** | `npm run bootstrap` | First-time setup: install deps, copy .env.example, typecheck. |
| **doctor** | `npm run doctor` | Environment health checker — verifies all tools and config. |
| **build:ci** | `npm run build:ci` | CI-grade build: typecheck → lint → electron-vite build. |

---

> [!TIP]
> **Protip:** Most `.ts` scripts in this directory can be run directly using `npx ts-node scripts/FILENAME.ts`.
