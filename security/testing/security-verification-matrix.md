# Continuous Security Verification Matrix

| Security Area | Verification Tool | Execution Cadence | Passing Criteria |
|---|---|---|---|
| **Frontend Secrets Boundary** | `scripts/guard-frontend-api-boundary.mjs` | Every Git Commit / PR | 0 forbidden tokens in frontend files |
| **Backend AI API Isolation** | `scripts/guard-vertex-only-backend.mjs` | Every Git Commit / PR | 0 direct AI calls from renderer |
| **Route & Endpoint Safety** | `scripts/guard-vertex-routing.mjs` | Every Git Commit / PR | All AI endpoints authenticated |
| **Dependency Vulnerabilities** | `npm audit --omit=dev` | Weekly & in CI | 0 Critical or High CVEs |
| **Type Safety & Contracts** | `npm run typecheck` | Every Git Commit / PR | Clean compilation across all 11 workspaces |
| **Unit & Integration Tests** | `npm run test:ci` | Every Git Commit / PR | 100% test pass rate |
| **SOC 2 Control Registry** | `node scripts/verify-soc2-controls.mjs` | Every Git Commit / PR | 100% controls valid with mapped policies |
