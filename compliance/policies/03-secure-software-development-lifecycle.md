# Secure Software Development Lifecycle (SSDLC) Policy (POL-003)

## 1. Purpose
To ensure that all code written for indii.music is systematically designed, reviewed, tested, and secured against vulnerabilities throughout the software lifecycle.

## 2. Development Standards
- **Framework Security**: All web applications utilize modern frameworks (Next.js, Vite, React) with automatic XSS escaping, strict Content Security Policies (CSP), and secure cookie attributes (`Secure`, `HttpOnly`, `SameSite=Strict`).
- **Input Validation**: All external inputs, whether from user requests, remote relay payloads, or third-party webhooks (e.g. Meta, Stripe), must be validated against strict schemas (Zod or TypeScript contracts).
- **Desktop Client Security**: The Electron desktop application enforces `contextIsolation: true`, `nodeIntegration: false`, disables remote module loading, and restricts navigation to trusted origins.

## 3. Code Review & Testing
- Every change to production-bound branches requires at least one peer code review by an authorized engineer.
- Pull requests must pass automated CI pipelines before merge:
  1. TypeScript compilation (`typecheck`)
  2. Static analysis and linting (`eslint`)
  3. API boundary security guards (`guard-frontend-api-boundary.mjs`)
  4. Unit and integration tests (`vitest`)
  5. End-to-end security/flow validation (`playwright`)

## 4. Threat Modeling
- Architecture changes involving identity, data ingress/egress, external integrations (e.g. Meta Graph API, Spotify API), or local executor controls require a documented STRIDE threat model prior to implementation.

*Approved by Leadership: 2026-09-17*
