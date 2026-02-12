## 2025-05-23 - Slot Component Child Constraint

**Learning:** The `asChild` prop (using Radix UI `Slot`) fails with `React.Children.only` error if the component attempts to render multiple children (e.g. `{isLoading && <Loader />} {children}`), even if the conditional is false (rendering `false` + `Element`).
**Action:** When using `asChild`, explicitly pass ONLY `children` to the `Slot` component. Conditional content (like loaders) must be either omitted or handled differently (e.g. wrapper component) to preserve the single-child requirement.

## 2025-05-24 - Fake Timers vs Axe

**Learning:** `vi.useFakeTimers()` inside `beforeEach` can cause `vitest-axe` tests to time out, likely due to interference with internal async operations or timeouts within `axe`.
**Action:** Scope `vi.useFakeTimers()` to the specific tests that require time manipulation, and use `try/finally` with `vi.useRealTimers()` to ensure cleanup, keeping accessibility tests on real timers.

## 2025-05-25 - Mocking Global Zustand Store

**Learning:** When testing components that consume a global Zustand store via `useStore(selector)`, standard `vi.mock` fails because the mock factory is hoisted before variable initialization.
**Action:** Use `vi.hoisted` to create a `storeRef` container, and initialize the store inside an async `vi.mock` factory (dynamically importing `zustand`). This allows the test to access and reset the store state via `storeRef.current`.
