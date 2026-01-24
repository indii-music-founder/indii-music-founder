
# Technical Roadmap & Debt

This document tracks technical debt, refactoring goals, and known issues.

## Active Issues

- [ ] **Fix ReferenceError: renderStartTime is not defined**
      *Context*: This error was reported but the specific file or code block causing it could not be located in the repository.
      *Action*: If encountered in a script, ensure `const renderStartTime = performance.now();` is defined before usage.

## Technical Debt

### Dependencies

- [ ] Upgrade `camera-controls` compatible with Node 22.
- [ ] Align `react` versions.

### Electron

- [ ] Move `preload.ts` to strictly Context Isolation safe APIs.
