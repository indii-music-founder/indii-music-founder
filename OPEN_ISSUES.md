# Critical Build Failures (Regression Report)

This document contains all surfaced issues that are currently causing the `main` branch to fail CI/CD build checks. These are the priority issues for the Fix Agent.

## 1. Global TypeScript Regressions (`@types/react` Conflict)
**Severity:** CRITICAL (Breaks > 60 files)
**Symptom:** `error TS2786: 'XYZ' cannot be used as a JSX component... Type 'bigint' is not assignable to type 'ReactNode'`
**Root Cause:** A newer dependency (likely `@remotion` or `@radix-ui`) has transitively pulled in `@types/react@19` and `@types/react-dom@19`. This conflicts globally with the project's React 18 typings, invalidating `ReactNode` across the entire codebase.
**Fix required:** Add `"@types/react": "18.3.3"` and `"@types/react-dom": "18.3.0"` to the `"overrides"` (or `"resolutions"`) block in the root `package.json` to lock the types down to version 18.

## 2. Broken Distribution Service Integrations
**Severity:** HIGH
**Files:**
- `packages/renderer/src/services/distribution/__tests__/SFTPDeliveryPipeline.test.ts`
- `packages/renderer/src/services/distribution/adapters/CDBabyAdapter.ts`
- `packages/renderer/src/services/distribution/adapters/DistroKidAdapter.ts`
- `packages/renderer/src/services/distribution/DistributionService.ts`
**Symptom:** Refactoring regressions. 
- The tests are trying to import `DistributionService` which doesn't exist (possibly renamed to `distributionService`).
- Adapters are calling `.listDirectory` and `.readFile` on `ElectronSFTPAPI`, which do not exist on that interface.
- `DistributionService.ts` is attempting to access `.report` and `.csvData` on objects that don't have those properties.

## 3. Firebase & Core Service Type Errors
**Severity:** HIGH
**Files:**
- `packages/renderer/src/services/firebase.ts`
- `packages/renderer/src/services/MembershipService.integration.test.ts`
**Symptom:** 
- `firebase.ts` throws `Cannot find name 'ReCaptchaEnterpriseProvider'`. A Firebase AppCheck import is missing.
- The `MembershipService` test tries to use `MembershipService` as a type interface instead of an instantiated value (needs `typeof MembershipService`).

## 4. Failing Unit Tests
**Severity:** HIGH
**Test Outputs:**
1. **`useReleases.test.ts` & `DesignCanvas.export.test.tsx`**: Both throw `TypeError: Cannot read properties of null (reading 'useState'/'useCallback')`. This is a classic React testing environment mismatch. It usually happens when the test renderer uses a different React instance than the components. This may be solved by fixing the `@types/react` conflict mentioned above.
2. **`DatasetQuality.validation.test.ts`**: Fails dataset assertions: "every agent dataset should have at least 20 examples (expected 20 <= 5)" and "total example count should be at least 900 (expected 0 >= 900)".
3. **`QA_Batching.test.ts`**: Throws `AppException: Quota check failed. Operation blocked to prevent untracked spend.` The TokenUsageService is blocking a mocked batch request during testing.

*Note: Sentry was also checked for the `indiimusic / indii_music_founder` organization, but no new unresolved crashes were found in production/staging. The app's breakages are entirely contained within the build/test pipeline.*
