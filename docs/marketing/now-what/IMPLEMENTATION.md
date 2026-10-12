# Implementation evidence

The existing landing page now has six situation links into Artist Passport. `entry` changes contextual copy only; unknown entries use the standard experience. Source, assessment ID and bounded UTM fields survive navigation and Studio redirect. Optional immutable campaign context is stored on assessments and signup user records. Founder reporting groups assessments by situation as well as source.

All 14 selectable priorities have distinct recommendations. The first two selected goals take precedence; rights observations and release status fill remaining slots. The UI now honors the existing two-goal persistence/security contract instead of silently dropping additional selections at save time.

Existing report delivery requires explicit assessmentConsent. Marketing consent remains separate. Requested summaries list selected goals and preserve attribution on claim URLs. PDF saving uses browser print; emails contain an HTML/text summary, not a PDF attachment. No new marketing scheduler is enabled. Follow-up copy and its unsubscribe/suppression requirements are in ROLLOUT.md.

Saving a report request now waits for the contact write and shows an actionable error if it fails. Existing assessment data is not rewritten when revisiting results. Page-arrival and completion events no longer repeat on contact typing or each wizard step.

Signup verification emits signup_verified after Firebase reload confirms verification. Studio onboarding analytics carries campaign fields and emits studio_meaningful_action for completed asset uploads. These analytics events are instrumentation, not evidence of verified customer conversion or product success.

Validation before delivery: focused landing, Firebase report, and admin tests; pure campaign parsing and 14-goal mapping tests; full Firestore rules suite; landing and workspace typecheck; affected-file lint. Mock-backed legacy tests and emulator policy checks are structural evidence only. Broad local rules run had two unrelated Storage grant failures; the affected Firestore suite passed independently.

Genuine acceptance remains a release gate: use production https://indii.music, actual authorized account details, real email verification and report receipt, reload persistence, and Studio hydration. Never infer this from CI alone. Record exact SHA/run and observed outcomes in the delivery response. Paid budget/date remain unset; external campaigns and follow-up emails are unpublished.
