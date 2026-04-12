# indiiOS Scripts Manifest

> **101 scripts** across dev, ops, testing, seeding, and deployment. Find what you need here before writing a new one.

---

## 🩺 Health & Environment

| Script                      | Runner                                      | Purpose                                                                              |
| --------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `doctor.sh`                 | `npm run doctor`                            | **Unified health check** — Node, deps, .env vars, git hygiene, sidecar, Firebase CLI |
| `validate-env.ts`           | `npx tsx scripts/validate-env.ts`           | Validate all required env vars are present and non-empty                             |
| `env-guardian.sh`           | `bash scripts/env-guardian.sh`              | Guard against secret exposure in env files                                           |
| `setup-dev-environment.sh`  | `bash scripts/setup-dev-environment.sh`     | Full dev machine bootstrap from scratch                                              |
| `setup-env.sh`              | `bash scripts/setup-env.sh`                 | Copy `.env.example` → `.env` with guided prompts                                     |
| `diagnose-api.ts`           | `npx tsx scripts/diagnose-api.ts`           | Test API connectivity (Gemini, Firebase, Vertex)                                     |
| `diagnose-gemini-models.ts` | `npx tsx scripts/diagnose-gemini-models.ts` | List available Gemini models for your API key                                        |
| `diagnose-stuck-agent.sh`   | `bash scripts/diagnose-stuck-agent.sh`      | Debug a hung agent pipeline                                                          |
| `verify-ai.test.ts`         | `npx vitest run scripts/verify-ai.test.ts`  | AI service smoke test suite                                                          |
| `verify-ai-features.ts`     | `npx tsx scripts/verify-ai-features.ts`     | Live smoke test for all major AI features                                            |

---

## 🏗️ Build & Deploy

| Script             | Runner                             | Purpose                                  |
| ------------------ | ---------------------------------- | ---------------------------------------- |
| `build-desktop.sh` | `bash scripts/build-desktop.sh`    | Full desktop build (all platforms)       |
| `build_sidecar.sh` | `bash scripts/build_sidecar.sh`    | Build the Python AI sidecar Docker image |
| `deploy-cors.sh`   | `bash scripts/deploy-cors.sh`      | Deploy CORS config to Firebase Storage   |
| `deploy-lambda.ts` | `npx tsx scripts/deploy-lambda.ts` | Deploy Lambda functions                  |
| `deploy_fix.sh`    | `bash scripts/deploy_fix.sh`       | Emergency deploy hot-patch               |

---

## 🧪 Testing & QA

| Script                     | Runner                                  | Purpose                                                             |
| -------------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| `run-gauntlet.sh`          | `bash scripts/run-gauntlet.sh`          | **Full E2E stress test (The Gauntlet)** — runs all Playwright specs |
| `agent-stress-test.mjs`    | `node scripts/agent-stress-test.mjs`    | Stress test the indii Conductor with concurrent requests            |
| `load-test.js`             | `node scripts/load-test.js`             | HTTP load test for API endpoints                                    |
| `stress-test-rag.ts`       | `npx tsx scripts/stress-test-rag.ts`    | RAG pipeline stress test                                            |
| `keyboard-audit.ts`        | `npx tsx scripts/keyboard-audit.ts`     | Accessibility keyboard navigation audit                             |
| `contrast-audit.ts`        | `npx tsx scripts/contrast-audit.ts`     | WCAG color contrast audit                                           |
| `check-merge-integrity.js` | `node scripts/check-merge-integrity.js` | Verify no regressions post-merge                                    |

---

## 🔍 Verification

| Script                       | Runner                                       | Purpose                                  |
| ---------------------------- | -------------------------------------------- | ---------------------------------------- |
| `verify-api-permissions.ts`  | `npx tsx scripts/verify-api-permissions.ts`  | Check all API key permissions            |
| `verify-auth-config.ts`      | `npx tsx scripts/verify-auth-config.ts`      | Verify Firebase Auth configuration       |
| `verify-rag.ts`              | `npx tsx scripts/verify-rag.ts`              | End-to-end RAG pipeline verification     |
| `verify-rag-filedata.ts`     | `npx tsx scripts/verify-rag-filedata.ts`     | Verify RAG file ingestion                |
| `verify-rag-filesearch.ts`   | `npx tsx scripts/verify-rag-filesearch.ts`   | Verify RAG search quality                |
| `verify-storage-live.ts`     | `npx tsx scripts/verify-storage-live.ts`     | Live Firebase Storage read/write test    |
| `verify-ddex-roadmap.ts`     | `npx tsx scripts/verify-ddex-roadmap.ts`     | DDEX pipeline completeness check         |
| `verify-symphonic.ts`        | `npx tsx scripts/verify-symphonic.ts`        | Symphonic distributor integration test   |
| `verify-gemini-image-gen.ts` | `npx tsx scripts/verify-gemini-image-gen.ts` | Gemini image generation smoke test       |
| `verify-google-ai.js`        | `node scripts/verify-google-ai.js`           | Google AI API connectivity check         |
| `verify-sonic-hash.ts`       | `npx tsx scripts/verify-sonic-hash.ts`       | Audio DNA hash verification              |
| `verify-gold-standard.ts`    | `npx tsx scripts/verify-gold-standard.ts`    | Full feature gold-standard test suite    |
| `verify-2026-roadmap.ts`     | `npx tsx scripts/verify-2026-roadmap.ts`     | Check 2026 roadmap feature readiness     |
| `verify-deep-dive.ts`        | `npx tsx scripts/verify-deep-dive.ts`        | Deep feature verification sweep          |
| `verify-touched-features.ts` | `npx tsx scripts/verify-touched-features.ts` | Smoke test for recently changed features |
| `verify-profile-art.ts`      | `npx tsx scripts/verify-profile-art.ts`      | Artist profile art generation test       |

---

## 🌱 Database Seeding

| Script                         | Runner                                         | Purpose                                       |
| ------------------------------ | ---------------------------------------------- | --------------------------------------------- |
| `seed-test-user.ts`            | `npx tsx scripts/seed-test-user.ts`            | Create a complete test user with full profile |
| `seed-test-account.ts`         | `npx tsx scripts/seed-test-account.ts`         | Seed a test artist account                    |
| `seed-earnings.ts`             | `npx tsx scripts/seed-earnings.ts`             | Seed mock earnings/royalty data               |
| `seed-fraud-rules.ts`          | `npx tsx scripts/seed-fraud-rules.ts`          | Seed fraud detection rules                    |
| `seed-licensing.ts`            | `npx tsx scripts/seed-licensing.ts`            | Seed licensing catalog data                   |
| `seed-touring.ts`              | `npx tsx scripts/seed-touring.ts`              | Seed touring/venue data                       |
| `seed_wiki.cjs`                | `node scripts/seed_wiki.cjs`                   | Seed knowledge base wiki entries              |
| `migrate-mock-to-firestore.ts` | `npx tsx scripts/migrate-mock-to-firestore.ts` | Migrate mock data to real Firestore           |

---

## 👤 User Management

| Script                      | Runner                                   | Purpose                             |
| --------------------------- | ---------------------------------------- | ----------------------------------- |
| `create-test-user.ts`       | `npx tsx scripts/create-test-user.ts`    | Create Firebase Auth test user      |
| `audit-auth.cjs`            | `node scripts/audit-auth.cjs`            | Audit all Firebase Auth users       |
| `audit-test-users.mjs`      | `node scripts/audit-test-users.mjs`      | List and audit test user accounts   |
| `update-agency-profile.mjs` | `node scripts/update-agency-profile.mjs` | Update agency/label profile data    |
| `sync-user-data.mjs`        | `node scripts/sync-user-data.mjs`        | Sync user data between environments |
| `send-reset.js`             | `node scripts/send-reset.js`             | Send password reset email           |

---

## 🎵 Audio & Video

| Script                          | Runner                                         | Purpose                              |
| ------------------------------- | ---------------------------------------------- | ------------------------------------ |
| `test-image-gen.ts`             | `npx tsx scripts/test-image-gen.ts`            | Test image generation pipeline       |
| `test-video-pipeline.mjs`       | `node scripts/test-video-pipeline.mjs`         | Test video generation end-to-end     |
| `generate-first-last-video.ts`  | `npx tsx scripts/generate-first-last-video.ts` | Generate bookend videos              |
| `create_vid_job.mjs`            | `node scripts/create_vid_job.mjs`              | Create a video processing job        |
| `check_vid_jobs_temp.mjs`       | `node scripts/check_vid_jobs_temp.mjs`         | Check pending video jobs             |
| `download_latest_video.mjs`     | `node scripts/download_latest_video.mjs`       | Download most recent generated video |
| `upload_video_to_firestore.mjs` | `node scripts/upload_video_to_firestore.mjs`   | Upload video metadata to Firestore   |
| `test-license-scanner.ts`       | `npx tsx scripts/test-license-scanner.ts`      | Test music license scanning          |
| `verify-sonic-hash.ts`          | `npx tsx scripts/verify-sonic-hash.ts`         | Verify audio DNA fingerprinting      |

---

## 📚 RAG & Knowledge Base

| Script                  | Runner                                  | Purpose                               |
| ----------------------- | --------------------------------------- | ------------------------------------- |
| `bulk-ingest-rag.ts`    | `npx tsx scripts/bulk-ingest-rag.ts`    | Bulk ingest documents into RAG corpus |
| `ingest-unified.ts`     | `npx tsx scripts/ingest-unified.ts`     | Unified ingestion pipeline            |
| `init-corpora.ts`       | `npx tsx scripts/init-corpora.ts`       | Initialize Vertex AI corpora          |
| `test-rag.ts`           | `npx tsx scripts/test-rag.ts`           | Test RAG query pipeline               |
| `test-pdf-rag.ts`       | `npx tsx scripts/test-pdf-rag.ts`       | Test PDF document ingestion           |
| `test-music-biz-rag.ts` | `npx tsx scripts/test-music-biz-rag.ts` | Test music business knowledge queries |
| `test-chunker.ts`       | `npx tsx scripts/test-chunker.ts`       | Test document chunking strategy       |
| `test-files-api.ts`     | `npx tsx scripts/test-files-api.ts`     | Test Gemini Files API                 |

---

## 🤖 Agent & AI

| Script                       | Runner                                    | Purpose                               |
| ---------------------------- | ----------------------------------------- | ------------------------------------- |
| `agent.py`                   | `python3 scripts/agent.py`                | CLI interface to indii Conductor      |
| `init_agent.sh`              | `bash scripts/init_agent.sh`              | Initialize agent runtime environment  |
| `run_agent_zero_manual.sh`   | `bash scripts/run_agent_zero_manual.sh`   | Manually trigger Conductor            |
| `run_all_agents.sh`          | `bash scripts/run_all_agents.sh`          | Start all specialist agents           |
| `simulate_agent_message.mjs` | `node scripts/simulate_agent_message.mjs` | Send a test message to an agent       |
| `start-proxy.ts`             | `npx tsx scripts/start-proxy.ts`          | Start AI proxy middleware             |
| `mock-inngest-worker.ts`     | `npx tsx scripts/mock-inngest-worker.ts`  | Run mock Inngest job worker           |
| `wire-r5-endpoints.py`       | `python3 scripts/wire-r5-endpoints.py`    | Wire R5 (Python) API endpoints        |
| `the-auditor.ts`             | `npx tsx scripts/the-auditor.ts`          | Run The Auditor agent for code review |
| `list-vertex-models.ts`      | `npx tsx scripts/list-vertex-models.ts`   | List available Vertex AI models       |

---

## 🗄️ Firestore & Infrastructure

| Script                     | Runner                                     | Purpose                                      |
| -------------------------- | ------------------------------------------ | -------------------------------------------- |
| `backup-firestore.sh`      | `bash scripts/backup-firestore.sh`         | Backup Firestore to GCS                      |
| `firestore-index-audit.ts` | `npx tsx scripts/firestore-index-audit.ts` | Audit Firestore composite indexes            |
| `mock-sftp-server.ts`      | `npx tsx scripts/mock-sftp-server.ts`      | Run mock SFTP server for distributor testing |

---

## 🔐 Security

| Script                      | Runner                                      | Purpose                                               |
| --------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| `git-scrub-credentials.sh`  | `bash scripts/git-scrub-credentials.sh`     | **DANGER** — Scrub credentials from git history (bfg) |
| `rotate-keys.ts`            | `npx tsx scripts/rotate-keys.ts`            | Rotate API keys and update Firestore                  |
| `audit-auth.cjs`            | `node scripts/audit-auth.cjs`               | Firebase Auth security audit                          |
| `test_honeypot.py`          | `python3 scripts/test_honeypot.py`          | Test honeypot trap effectiveness                      |
| `test_zeroization.py`       | `python3 scripts/test_zeroization.py`       | Verify memory zeroization on exit                     |
| `test_protocol.py`          | `python3 scripts/test_protocol.py`          | Test security protocol implementations                |
| `test_context_bleed.py`     | `python3 scripts/test_context_bleed.py`     | Test for agent context leakage                        |
| `verify-api-permissions.ts` | `npx tsx scripts/verify-api-permissions.ts` | Audit all API key scopes                              |
| `verify_bridge.py`          | `python3 scripts/verify_bridge.py`          | Verify IPC bridge security                            |

---

## 🎨 Assets & UI

| Script                      | Runner                                   | Purpose                                 |
| --------------------------- | ---------------------------------------- | --------------------------------------- |
| `generate-pwa-icons.cjs`    | `node scripts/generate-pwa-icons.cjs`    | Generate PWA icon set from source       |
| `generate-pwa-icons.sh`     | `bash scripts/generate-pwa-icons.sh`     | Shell wrapper for PWA icon generation   |
| `add-generated-art.ts`      | `npx tsx scripts/add-generated-art.ts`   | Add AI-generated art to artist profiles |
| `upload-persona-assets.mjs` | `node scripts/upload-persona-assets.mjs` | Upload agent persona avatar assets      |
| `export-pitch-decks.ts`     | `npx tsx scripts/export-pitch-decks.ts`  | Export marketing pitch deck assets      |

---

## 📊 Analytics & Reporting

| Script                   | Runner                                   | Purpose                                |
| ------------------------ | ---------------------------------------- | -------------------------------------- |
| `generate-changelog.sh`  | `npm run changelog`                      | Generate CHANGELOG.md from git history |
| `verify-2026-roadmap.ts` | `npx tsx scripts/verify-2026-roadmap.ts` | Roadmap feature gap report             |
| `test-users.json`        | N/A                                      | Test user fixture data file            |

---

## 🛠️ Lifecycle Hooks (Agent System)

| Script             | Trigger        | Purpose                  |
| ------------------ | -------------- | ------------------------ |
| `after_edit.sh`    | Post-edit hook | Run after AI edits files |
| `session_start.sh` | Session start  | Initialize agent session |
| `on_stop.sh`       | Session end    | Checkpoint and clean up  |

---

> **Convention:** TypeScript scripts run with `npx tsx`. JavaScript with `node`. Python with `python3`. Shell scripts with `bash`.
>
> **Adding a new script?** Add a row to this table. Keep it discoverable.
