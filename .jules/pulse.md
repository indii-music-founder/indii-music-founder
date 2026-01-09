## 2025-05-27 - [Video Workflow Loading States]
**Learning:** `VideoWorkflow` handles state transitions via side-effects (toasts) rather than persistent UI states for errors. This means tests must verify `toast.error` calls rather than looking for a "Failed" screen.
**Action:** When testing "Error" states in workflows that auto-reset to idle, spy on `useToast().error` and verify the status reset logic.
