# Code Style

Observable conventions only (no invented rules):

- **TypeScript:** strict mode, ES2022, `@typescript-eslint/no-explicit-any: warn` (not error), `^_`-prefixed unused vars ignored
- **ESM everywhere** (`"type": "module"` in root)
- **Path aliases required** for cross-workspace imports (`@/`, `@shared/`, `@agents/`)
- **Component organization:** primitives in `packages/renderer/src/components/ui/`, module-specific in `packages/renderer/src/modules/<name>/components/`
- **Lazy loading:** all feature modules via `React.lazy` in `packages/renderer/src/core/App.tsx`
- **State:** Zustand slice per domain (`packages/renderer/src/core/store/slices/*`), `useShallow` to prevent re-renders
- **Testing:** co-locate `*.test.ts` / `*.test.tsx` with source; E2E specs in `/e2e/`
- **Mocks:** Firebase services globally mocked in `packages/renderer/src/test/setup.ts`
- **Commits:** conventional commit style (`feat:`, `fix:`, `refactor:`), release-please automation on `main`
- **Pre-commit:** `/plat` pre-flight required on substantive branches; Error Ledger lookup mandatory before debug
