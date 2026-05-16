# Domain Context

indii is a **single-context** monorepo. All domain knowledge and architectural decisions are centralized.

## Primary Source of Truth: CLAUDE.md

The canonical domain context lives in [`CLAUDE.md`](../../CLAUDE.md) at the repo root. This file is mirrored across all AI agent environments (Claude, Gemini, etc.) and contains:

- **Project Overview** — What indii does, its place in the music industry
- **The 3-Layer Architecture** — Directive / Orchestration / Execution separation
- **Codebase Structure** — Where everything lives
- **Tech Stack** — Frontend (React, Vite, Tailwind, Zustand), Backend (Firebase, Genkit), Desktop (Electron)
- **Key Conventions** — Path aliases, state management patterns, module system, component organization
- **Testing & CI/CD** — Test commands, GitHub Actions pipeline, deployment targets
- **Operating Principles** — Error memory protocol, API credentials policy, platinum quality standards

When developing:

1. **For architecture questions** → Read the "3-Layer Architecture" and "Codebase Structure" sections
2. **For tech stack questions** → Consult the "Tech Stack" table
3. **For state management** → Review "State Management (Zustand)" under Key Conventions
4. **For code quality** → Reference the platinum standards docs linked in the "Operating Principles" section
5. **For past errors** → Check `.agent/skills/error_memory/ERROR_LEDGER.md` before debugging

## No Architectural Decision Records (ADRs) Yet

ADRs are not currently in use. Design decisions are documented inline in CLAUDE.md and in issue discussions.

## Monorepo Structure

While the repo contains multiple packages (`packages/renderer`, `packages/main`, `packages/firebase`, etc.), there is one unified domain context. Treat all packages as part of the same architectural vision.

## When a Skill Reads "Domain Context"

The skill will read [`CLAUDE.md`](../../CLAUDE.md) to understand:
- Architectural patterns (3-layer, A2A swarm, specialist agents)
- Code organization (module system, state slices, lazy loading)
- Tech stack constraints (Firebase, Genkit, Electron, React)
- Quality standards (platinum checks, error ledger, conventions)

If the skill asks "what's the domain context?", point it to `CLAUDE.md`.
