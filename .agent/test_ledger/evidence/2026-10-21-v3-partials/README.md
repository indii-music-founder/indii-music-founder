# ISSUE-1439 genuine production observation — 2026-10-21

Environment: canonical https://indii.music/ login entry → https://app.indii.music/ in Chrome, existing signed-in founder account. Signup not observed; actual subscription tier unknown. No authentication or product-state injection.

1. Finance → Royalties visibly showed Royalties Prediction and `/finance?tab=royalties`.
2. Creative → Legal → browser Back twice restored Royalties.
3. Full reload reset the route to `/finance` and showed Revenue Overview.
4. Independent fresh tab opened with the observed `/finance?tab=royalties` link also reset to `/finance` / Overview.

`reload-overview.png` captures the resulting Finance view, excluding unrelated account conversation history. This is failure evidence, not acceptance of the repair. Exact-SHA delivery and deployed retest remain pending.
