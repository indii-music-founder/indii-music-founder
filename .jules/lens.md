## 2024-05-23 - Video Generation Quota Service Mismatch
**Learning:** `VideoGenerationService` relies on `subscriptionService` (SubscriptionService) for quota checks, not `MembershipService`. Tests must mock `subscriptionService.canPerformAction` to simulate quota failures.
**Action:** Updated unit tests to mock `subscriptionService` instead of `MembershipService`. Verified imports in source code to prevent regression.
