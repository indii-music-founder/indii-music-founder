# ISSUE-1439 genuine production observation — 2026-10-21

Environment: canonical https://indii.music/ login entry → https://app.indii.music/ in Chrome, existing signed-in founder account. Signup not observed; actual subscription tier unknown. No authentication or product-state injection.

1. Finance → Royalties visibly showed Royalties Prediction and `/finance?tab=royalties`.
2. Creative → Legal → browser Back twice restored Royalties.
3. Full reload reset the route to `/finance` and showed Revenue Overview.
4. Independent fresh tab opened with the observed `/finance?tab=royalties` link also reset to `/finance` / Overview.

`reload-overview.png` captures the resulting Finance view, excluding unrelated account conversation history. This is failure evidence, not acceptance of the repair. Exact-SHA delivery and deployed retest remain pending.

## Deployed acceptance

Pushed SHA: `10a792a8bfaf6d1fdf9fa3a79efe4613e8b83905`.
Exact-SHA CI and production: https://github.com/indii-music-founder/indii-music-founder/actions/runs/39668025843 — success.

Native Chrome independently verified Finance Royalties fresh-link open, full reload, and Finance → Creative → Legal → Back → Back. All retained `?tab=royalties` and Royalties Prediction. Distribution's direct `?tab=qc` link also retained its query and selected Pre-Flight Audio & QC. Existing account genuinely signed in by the user; signup not observed; actual subscription tier unknown (Founding Member badge is not a tier). The tab automation bridge had paused document responses; its later auth timeout observations are not proof that the user's credentials expired. No authentication or account state was injected.

The next requested queue is the 43 leading OPEN entries, after the 22 original PARTIAL entries. Recounted from canonical issue headings on 2026-10-21; old mentions in progress notes are not additional open issues.
