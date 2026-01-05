# Platinum Polish Standards (V1.0)

"Platinum Polish" is the rigorous quality assurance and refactoring standard for the indiiOS codebase. It ensures production-readiness, maintainability, and developer sanity.

## The 5 Pillars of Platinum

### 1. Type Safety (The "No Any" Rule)

- **Rule**: Eliminate `as any` and `any` types.
- **Action**: Define explicit interfaces (e.g., `interface GenerateImageResponse`).
- **Exceptions**: `unknown` is permitted for boundary crossing (e.g., `window as unknown as CustomWindow`), but must be immediately narrowed.

### 2. Log Hygiene (The "Zero Noise" Rule)

- **Rule**: Production builds must have zero "debug spam".
- **Action**:
  - `console.log` -> **DELETE** (or promote if critical operation info).
  - `console.info` -> Use for **Lifecycle Events** (e.g., "Service Started", "Connection Established").
  - `console.warn` -> Use for **Recoverable Issues** (e.g., "Retrying connection...").
  - `console.error` -> Use for **Terminal Failures** (with full stack traces).

### 3. Error Handling (The "Graceful Fallback" Rule)

- **Rule**: No silent failures. The user must know the state.
- **Action**:
  - Services must throw typed errors (e.g., `AppException`).
  - UI must catch errors and display Toasts or Fallback UI.
  - Never return empty objects/arrays to mask failures unless specifically documented as "Null Object Pattern".

### 4. Code Sanitation (The "Boy Scout" Rule)

- **Rule**: Leave the code cleaner than you found it.
- **Action**:
  - Remove commented-out "zombie code".
  - Remove unused imports (ESLint usually catches this, but check specifically).
  - Ensure JSDoc/TSDoc exists for public service methods.

### 5. Verification (The "Anti-Flake" Rule)

- **Rule**: A test passing once is luck. Passing 3 times is stability.
- **Action**:
  - Critical path tests must pass 3x sequential runs without failure.
  - Use `npm test -- <file> && npm test -- <file> && npm test -- <file>`.

## Rollout Checklist

When applying Platinum Polish to a module:

1. **Scan**: `grep -r "console.log" src/modules/<name>`
2. **Scan**: `grep -r "as any" src/modules/<name>`
3. **Refactor**: Apply changes.
4. **Verify**: Run module-specific tests.
