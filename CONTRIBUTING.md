# Contributing to indiiOS

Thank you for your interest in contributing to **indiiOS**! This document explains the workflow, conventions, and quality standards that keep the codebase stable and maintainable.

---

## ⚡ Quick Setup

```bash
git clone https://github.com/the-walking-agency-det/indiiOS-Alpha-Electron.git
cd indiiOS-Alpha-Electron
make prime          # installs deps + runs health check
cp .env.example .env  # fill in your API keys
make dev-web        # fastest iteration loop (Vite only, :4243)
```

> Full setup details are in the [README Quick Start](README.md#-quick-start-15-minutes).

---

## 🌿 Branch Naming

Use the format: `<type>/<short-description>`

| Type | Use When |
|------|----------|
| `feat/` | Adding a new feature |
| `fix/` | Fixing a bug |
| `refactor/` | Restructuring without behavior change |
| `docs/` | Documentation only |
| `test/` | Adding or fixing tests |
| `chore/` | Tooling, deps, CI, config changes |

**Examples:**
- `feat/conductor-retry-logic`
- `fix/boardroom-chart-crash`
- `refactor/distribution-service-split`

---

## 📝 Commit Messages

We enforce **[Conventional Commits](https://www.conventionalcommits.org/)** via a `commit-msg` Git hook. Commits that don't match the pattern will be rejected automatically.

**Format:** `<type>(<optional scope>): <description>`

```
feat(agent): add Conductor retry logic
fix: resolve boardroom pipeline hang
chore(deps): bump husky to 9.1
docs(readme): add Quick Start section
test(creative): add canvas persistence spec
refactor(distribution): extract DDEX mapper
```

**Valid types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `wip`

> **Tip:** `wip` commits are allowed for work-in-progress but should be squashed before merging.

---

## 🔄 Pull Request Process

### Before Opening a PR

Run the full validation pipeline:

```bash
make validate       # lint → typecheck → test (one command)
```

Or equivalently: `npm run validate`

### PR Checklist

- [ ] Branch is up-to-date with `main`
- [ ] `make validate` passes locally
- [ ] New code has tests (or explain why not)
- [ ] No `console.log` / `debugger` statements left behind
- [ ] Commit messages follow Conventional Commits format
- [ ] If modifying Firebase schemas: `firestore.rules` and/or `storage.rules` updated

### PR Title

Use the same Conventional Commits format for PR titles:
- `feat(video): add Veo 3.1 Director's Cut QA step`
- `fix(auth): resolve token refresh race condition`

### Review Expectations

- All PRs require at least 1 approving review
- CI must pass (lint → typecheck → test → build)
- Reviewers focus on: correctness, test coverage, architecture alignment, security

---

## 🏗️ Code Style

### TypeScript

- Use `const` / `let` (never `var`)
- Strict equality (`===`)
- Named exports (avoid default exports)
- Mandatory semicolons
- Use the `@/` path alias for imports:
  ```typescript
  import { Something } from '@/services/ai/AIService';  // ✅
  import { Something } from '../../services/ai/AIService';  // ❌
  ```

### AI Model Policy

All AI model references must use the centralized config:

```typescript
import { AI_MODELS } from '@/core/config/ai-models';
// Use: model: AI_MODELS.TEXT.FAST
```

**Never** hardcode model strings. See `MODEL_POLICY.md` for the full policy.

### Component Organization

- **Service Layer** (`src/services/`): Business logic only
- **UI Layer** (`src/modules/`): Rendering and user events only
- **Shared** (`src/components/ui/`): Reusable Radix-based primitives
- Module-specific components live in `src/modules/<name>/components/`

### State Management

- Zustand slices in `src/core/store/slices/`
- Use `useShallow` from `zustand/react/shallow` to prevent unnecessary re-renders
- Never put async logic in store slices — use services

---

## 🧪 Testing

### Running Tests

```bash
make test          # Vitest watch mode
make test-ci       # Vitest once (CI mode)
make test-e2e      # Playwright E2E (Chromium)
make test-e2e-all  # Playwright all browsers
```

### Test Co-location

Co-locate tests with source files:
```
src/services/agent/ConductorService.ts
src/services/agent/ConductorService.test.ts
```

### The Two-Strike Rule

If a fix fails verification **twice**:
1. STOP the current approach
2. Re-diagnose with extensive logging
3. Propose a fundamentally different solution

---

## 🧰 Useful Commands

| Command | Description |
|---------|-------------|
| `make help` | Show all available Makefile targets |
| `make doctor` | Environment health check |
| `make validate` | Full pre-PR validation (lint + typecheck + test) |
| `make dev-web` | Vite-only dev server (:4243) |
| `make clean` | Remove build artifacts |
| `make nuke` | Nuclear reset (rm node_modules, reinstall) |
| `npm run scripts` | View the full scripts catalog |

---

## 🔐 Security

- **Never** commit secrets (Stripe keys, service accounts, GitHub tokens)
- Firebase API keys are identifiers, not secrets — security is enforced via Security Rules
- The pre-commit hook scans for leaked patterns automatically
- See [`docs/API_CREDENTIALS_POLICY.md`](docs/API_CREDENTIALS_POLICY.md) for details

---

## 📚 Further Reading

| Document | Purpose |
|----------|---------|
| [README](README.md) | Project overview and architecture |
| [Architecture Standard](directives/architecture_standard.md) | 3-layer architecture guidelines |
| [Model Policy](MODEL_POLICY.md) | AI model selection rules |
| [Scripts Catalog](scripts/SCRIPTS_CATALOG.md) | All available automation scripts |
| [API Credentials Policy](docs/API_CREDENTIALS_POLICY.md) | Credential management rules |

---

*Thank you for contributing. Together we're building the sovereign creative engine for independent artists.* 🎵
