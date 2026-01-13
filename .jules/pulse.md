## 2025-05-27 - [Video Workflow Loading States]
**Learning:** `VideoWorkflow` handles state transitions via side-effects (toasts) rather than persistent UI states for errors. This means tests must verify `toast.error` calls rather than looking for a "Failed" screen.
**Action:** When testing "Error" states in workflows that auto-reset to idle, spy on `useToast().error` and verify the status reset logic.

## 2025-06-01 - [Marketing Dashboard FOUC]
**Learning:** The `CampaignDashboard` was experiencing a "Flash of Zero Content" (FOUC) because the `isLoading` state from `useMarketing` was being ignored. This resulted in the user seeing an "Active Campaigns" header or empty state immediately, even while data was being fetched.
**Action:** Always consume `isLoading` from data hooks and assert its effect in unit tests (e.g., ensure loaders are present and content is hidden). Created `CampaignDashboard.pulse.test.tsx` to guard against this regression.

## 2025-06-03 - [Licensing Dashboard Race Condition]
**Learning:** `useLicensing` had a race condition where `isLoading` was set to false as soon as the *first* of multiple subscriptions returned. This caused a "Flash of Empty Content" (showing "No Pending Clearances") while the requests stream was still loading.
**Action:** Use derived state (e.g., `!licensesLoaded || !requestsLoaded`) for composite loading flags instead of a single boolean state variable. Created `LicensingDashboard.pulse.test.tsx` to verify that loading remains true until *all* streams settle.
