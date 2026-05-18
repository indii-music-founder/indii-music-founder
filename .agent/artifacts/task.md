# Task List: Project Isolation

## Phase 0: GitHub & Local Repository Re-Branding
- [x] Rename remote repository to `indii-music-founder`.
- [x] Update local git tracking via `git remote set-url`.
- [x] Verify severance from legacy agency endpoint.

## Phase 1: Python Repository Discovery & Exposure Audit
- [x] Scan codebase for credential files (`*.env`, `*.json`).
- [x] Analyze codebase for third-party API dependencies (Stripe, Sentry, Firebase, etc.).
- [x] Generate Implementation Plan itemizing secrets and replacements.

## Phase 2: Browsing & Documentation Verification
- [x] Cross-reference APIs against standalone verification requirements (Firebase Blaze, OAuth Consent, Webhooks).
- [x] Document target setup parameters explicitly inside the agent task list.

## Phase 3: Configuration Purge & Environment Architecture
- [x] Extract all existing environment variables from source logic.
- [x] Enforce zero hardcoding (abstracting into environment parsers).
- [x] Create standardized `.env.example` disconnected from legacy nomenclature.
- [x] Generate robust `.gitignore` excluding `venv/`, `.venv/`, `*.json`, and `.env` files.

## Phase 4: CI/CD & Pipeline Audit
- [x] Locate and parse deployment pipelines (`.github/workflows`).
- [x] Strip hardcoded authorization tokens and deployment hooks.
- [x] Prepare clean configurations for new deployment secrets.
