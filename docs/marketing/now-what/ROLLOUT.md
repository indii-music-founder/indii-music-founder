# Now what? — rollout and measurement

## Campaign contract

Theme: Now what? Brand: indii.music. Existing tagline: music business at the speed of you.
Message: You make the music. We help you figure out what comes next.
Six campaign files contain video scripts, carousel copy, static posts, educational articles, and two ad variants. These are production briefs and copy, not rendered videos or published posts.

## Four-week organic calendar

Dates are relative to launch; launch date is unset. Publish on Instagram and Facebook, adapt scripts for Reels and YouTube Shorts, and publish articles on owned channels once reviewed. No automatic outreach.

| Week | Monday | Wednesday | Friday |
|---|---|---|---|
| 1 | First song: static + article | Already released: carousel + article | First song: short video |
| 2 | Local band: static + article | Growing audience: carousel + article | Local band: short video |
| 3 | Earning income: static + article | Returning artist: carousel + article | Already released: short video |
| 4 | Growing audience: short video | Earning income: carousel | Returning artist: short video |

Reuse the remaining prepared formats as follow-ups after reviewing audience questions. Link every asset to its matching entry; distinguish each asset with utm_content.

## Consent-aware email drafts

The existing transactional service delivers the requested report only when assessmentConsent is true. Marketing consent is separate, unchecked by default. The following sequence is prepared copy, not an enabled scheduler. Do not send until a working unsubscribe destination, suppression checks, sender configuration, and publication authorization are verified. Do not substitute report consent for marketing consent.

Day 2 — Subject: Your first next step
Hi {{artistName}}, your Passport priorities are {{goals}}. Choose one task from your report and define what finishing it looks like. You do not have to tackle everything at once. Review your report: {{reportUrl}}.
Footer: You opted in to indii.music updates. Unsubscribe: {{unsubscribeUrl}}.

Day 5 — Subject: Put the plan to work
Hi {{artistName}}, now that you have a first priority, gather the assets and information it needs. Explore the indii.music platform guide to see the relevant workflows: https://indii.music/?from=passport_email. Studio capabilities and access follow current beta availability.
Footer: You opted in to indii.music updates. Unsubscribe: {{unsubscribeUrl}}.

Day 9 — Subject: Ready for what comes next?
Hi {{artistName}}, your music business can start with one completed task. Continue with your Artist Passport: {{claimUrl}}. Your saved answers can help set up your profile; account access follows the current beta process.
Footer: You opted in to indii.music updates. Unsubscribe: {{unsubscribeUrl}}.

Send each step at most once per opted-in assessment. Check current consent and suppression immediately before each send, stop on withdrawal, and use a provider idempotency key per assessment and step. Suppress this acquisition sequence after account claim. Never send unresolved template placeholders.

## Paid test — prepared, unpublished

Platform: Meta, Instagram and Facebook placements. First test situations: first-song, already-released, local-band. Two variants per situation. Objective: qualified traffic to Passport; optimize to completions only after confirming event delivery and adequate volume. Exclude existing converted customers where consented audience data permits. Budget and dates remain unset; no ad-account mutations or spend are authorized here.

## Measurement

Review after the first 14 days of organic activity. Existing Passport events cover views, starts, completed steps, assessment completion, report requests, and signup clicks. Events include validated entry and UTM context. Signup emits signup_verified only after Firebase refresh confirms verification; Studio onboarding events retain campaign attribution. studio_meaningful_action records a completed onboarding asset upload. Use the earliest such event per analytics user to measure initial activation; opening Studio alone is not activation. Founder dashboard groups persisted assessments by situation and source; counts are restricted to its latest 1,000 assessments.

Calculate start-to-completion rate in analytics; report-request and account-claim rates from persisted assessments. A claim is not proof of verified email, paid conversion, or first meaningful Studio action. Verify those downstream outcomes with actual account/workflow evidence before publishing an activation metric. No modeled conversion rate or ROI is customer evidence.

## Acceptance and launch gates

Require local typecheck, lint, pure recommendation and attribution tests, structural regressions, rule validation, exact-SHA CI, and genuine production journey. Record the actual account and plan, report receipt, auth continuity, and reload persistence. If email verification requires user input, present the official flow and wait. Do not inject authentication or fabricate success.

Before publishing campaigns: review copy and visuals, verify the real funnel, choose date and paid budget, and approve named external publication. No external messages or ads have been sent by this implementation.
