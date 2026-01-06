# Agent Stability & Mocking Directive

## Goal

Resolve systemic test failures in the agent architecture by standardizing mocks and fixing context initialization regressions.

## Triage Priority

1. **TraceService Regression**: Fix `Cannot read properties of undefined (reading 'id')` in `startTrace`.
2. **Streaming API Standardization**: Fix `AI.generateContentStream is not a function` and `getReader` errors.
3. **Firebase Mock Sync**: Add `remoteConfig` to the global firebase mock.

## Verification

- Run `npm test src/services/agent` after each fix to track progress.
