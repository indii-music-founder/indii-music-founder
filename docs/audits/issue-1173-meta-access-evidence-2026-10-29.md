# ISSUE-1173: Meta access evidence — 2026-10-29

Status: PARTIAL. This records external setup evidence; it does not close the integration issue.

## Observed environment

Read-only inspection used Meta’s official developer dashboard in an existing genuinely authenticated browser session, after the owner authorized Meta access verification. No account or app was created in this run. No indii customer signup, plan, entitlement, or free-tier path was exercised.

- [Live app dashboard](https://developers.facebook.com/apps/1442818421044460/dashboard/): `indii.music`, public app ID `1442818421044460`, Administrator access, Live/Published. Dashboard showed no required action items.
- Linked business `wiil`: **Verified** on the Verification page.
- Marketing API ads-management use case: **Limited access** tier; `ads_management`, `ads_read`, and `business_management` **Ready for testing**, with zero calls shown. Configured use cases also included ad measurement, Instagram messaging/content, and Page management.
- [App Review](https://developers.facebook.com/apps/1442818421044460/app-review/): **Not submitted**. New requests visibly included Marketing API Access Tier, `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `business_management`, and `ads_read`. This observation does not assert a complete permission inventory.

The old “no Meta Business account” prerequisite is superseded by this evidence. Live mode, business verification, configured use cases, and testing labels do not establish approved production API capabilities or working indii integration.

## Still required

1. Verify the deployed `META_APP_ID`/`VITE_META_APP_ID` binding through authorized configuration inspection; it has not been matched to this app.
2. Verify deployed callable coverage and fail-closed behavior. Source inspection found all five named callables in `packages/firebase/src/marketing/marketingCallables.ts`, re-exported by `packages/firebase/src/index.ts`; the historical assertion that they do not exist is stale. Source presence does not prove deployment or provider success.
3. Establish the permission/access tier needed for the intended customer population and complete any owner-controlled review requirements.
4. Verify genuine authorized API responses and receipts. Campaign creation, publishing, or spending needs an explicitly bounded owner-approved operation; dashboard metadata cannot substitute for that proof.

No tokens or app secrets were accessed or minted, no scopes granted, no review submitted, and no ads/posts/spend or production configuration changes occurred. Private business identifiers and credentials are excluded from this report.

## Repository validation

Documentation-only change. Ledger integrity and the repository pre-commit policy/type/security gates are required before publication. Existing structural application tests are not evidence of live Meta acceptance.
