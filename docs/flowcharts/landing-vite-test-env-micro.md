# Landing Page Client Environment & Test Environment Integration

This diagram maps the environment resolution flow for Vite client code and the Vitest test workspace discovery.

```mermaid
flowchart TD
    subgraph Client Build Phase ["Vite Client Build"]
        A1["Process Env Read"] -->|NEXT_PUBLIC_AUTH_HANDOFF_URL| A2{"Vite Static Analysis"}
        A2 -->|Requires prefix VITE_ by default| A3["Compiled to Undefined"]
        A2 -->|With envPrefix: ['VITE_', 'NEXT_PUBLIC_']| A4["Replaced with Build Environment Value"]
        A4 --> A5["import.meta.env.NEXT_PUBLIC_AUTH_HANDOFF_URL"]
    end

    subgraph Test Discovery ["Vitest Workspace Suite"]
        B1["npx vitest run"] --> B2{"vitest.workspace.ts"}
        B2 -->|Includes packages/landing| B3["Landing App.test.tsx & page.test.tsx run"]
        B3 --> B4["setupFiles: packages/renderer/src/test/setup.ts"]
        B4 --> B5["Define globalThis.IS_REACT_ACT_ENVIRONMENT = true"]
        B5 --> B6["React DOM act simulations run without warning noise"]
    end
```

## Transition Breakdown

### Vite Client Environment Handling
- **Process vs Import Meta**: The landing page package uses Vite rather than Next.js. The legacy environment reads pointing to `process.env.NEXT_PUBLIC_*` resulted in compilation target failures or runtime undefined fallbacks.
- **Prefix Expansion**: By configuring `envPrefix: ['VITE_', 'NEXT_PUBLIC_']` in the landing package's `vite.config.ts`, Vite is taught to expose both namespaces to the client-side code bundle.
- **Vite Resolution**: Code reads `import.meta.env.VITE_AUTH_HANDOFF_URL || import.meta.env.NEXT_PUBLIC_AUTH_HANDOFF_URL` to support both native Vite variables and legacy Next.js deployments seamlessly.

### Vitest Workspace & Warnings Suppression
- **Monorepo Discovery**: Adding `packages/landing/src/**/*.{test,spec}.{ts,tsx}` to `vitest.workspace.ts` binds the landing page tests directly to the parent `npm test` runner.
- **Testing Flag Suppression**: Because React DOM 18's testing `act()` mechanism is used directly in these suites without pulling in `@testing-library/react` (which sets the testing environment flags by default), React emitted noisy `Warning: The current testing environment is not configured to support act(...)` logs.
- **Global Flag Hook**: Injecting `globalThis.IS_REACT_ACT_ENVIRONMENT = true` at the top of the global `setup.ts` file solves this globally for all suites running in JSDOM, guaranteeing a clean and readable console output in local and CI test runs.
