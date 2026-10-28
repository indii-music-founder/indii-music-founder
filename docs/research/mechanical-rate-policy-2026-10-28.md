# Mechanical-rate product decision — 2026-10-28

Issue: CI-V3-20261019-05, with the existing ISSUE-1469 estimate lineage. This is a dated engineering/policy review, not legal clearance or evidence of a paid license.

## Effective rule and proposals

| Evidence | Verified distinction | Product decision |
| --- | --- | --- |
| [37 CFR 385.11(a), eCFR](https://www.ecfr.gov/current/title-37/chapter-III/subchapter-E/part-385/subpart-B/section-385.11), displayed current through October 26, 2026 | For 2026 US physical phonorecords and permanent downloads, use the larger of 13.1 cents per work or 2.52 cents per minute; count each partial minute. Annual adjustments are published separately. | Keep those rates scoped to 2026 and these formats. Require duration; never carry the table into an unverified year. |
| [Official Phonorecords V docket](https://app.crb.gov/case/detail/25-CRB-0013-PR%20%282028-2032%29?max=10&order=desc&sort=submittedDate) | Docket 25-CRB-0013-PR concerns 2028–2032 and is displayed open, in discovery. Party submissions are not final rules. | Do not substitute proposed rates for effective statutory rates. No filing or other external action is authorized by this review. |
| [Spotify public written direct statement, document 79682](https://app.crb.gov/document/download/79682), PDF page 18, dated October 5 and filed October 7, 2026 | Spotify proposes carrying the 15.35% service-revenue headline rate through 2028–2032 and otherwise retaining current rules. This is advocacy, not an adopted rate or a flat artist payout per stream. | No production accounting or forecasting formula changes from this proposal. |
| [Apple public written direct statement, document 79675](https://app.crb.gov/document/download/79675), PDF page 2 and footnote 1 | Apple similarly proposes continuing the Phonorecords IV agreement, with its 2027 15.35% headline rate, for the next period. | Same decision; do not treat a percentage headline as the entire streaming calculation. |

The [October 6 Digital Music News report](https://www.digitalmusicnews.com/2026/10/06/phonorecords-v-streaming-rate-proposal/) describes a competing songwriter-side proposal of $0.003 per interactive stream/limited download for 2028, followed by inflation adjustments. That numeric proposal is **secondary reporting only in this review**: the linked testimony copy required a subscription, and its original October filing was not independently inspected here. It is neither verified as enacted nor used in product code. Do not conflate it with sound-recording webcasting rates or physical/download rates. The primary Spotify/Apple filings above establish their own proposed positions, not the correctness of another party's characterization.

## Current implementation and repair

The cover-track form in `packages/renderer/src/modules/publishing/components/MechanicalRoyaltyPanel.tsx` previously estimated copies × $0.131 and never collected duration. Although `MechanicalRoyaltyService.createLicense` could apply the minute rate, this caller never supplied the optional duration, so a six-minute work at 1,000 copies displayed and recorded $131 instead of the $151.20 estimate.

`mechanicalEstimate.ts` now owns the shared pure calculation. The form requires seconds and whole positive copies, displays the same estimate the service computes, and labels its scope and limits. The service requires duration before creating the existing record. Both use the current UTC year, and the helper rejects years outside the verified 2026 table. Invalid numbers and unsafe arithmetic are rejected; integer ten-thousandths of USD preserve rate precision, with the aggregate estimate rounded once to cents. Provider rounding, charges and license approval remain separate.

No streaming accounting formula is added. No speculative Phonorecords V rate enters the estimate. Existing license IDs, storage locations and clearance-state behavior are unchanged; the calculation is not an authorization boundary or a substitute for vendor integration.

## Validation and remaining evidence

- 22 pure tests cover the greater-of rule, minute fractions, cent rounding, invalid duration/copies, overflow and refusal of unverified rate years.
- Nine pre-existing mock-backed service tests remain structural checks only. Their successful creation input now explicitly supplies duration. They do not prove Firestore persistence, HFA lookup or licensing.
- Full repository typecheck and scoped ESLint passed. Ledger/test-quality/diff checks are recorded with delivery.
- Jev review is advisory; the rule and implementation evidence, rather than model confidence, determine the decision.

Signed-in form submission, persisted-record reload, real provider charges and actual license issuance remain unverified. Future policy work must inspect the competing original creator/publisher filings and any subsequent CRB orders, then verify the published effective-year rule before updating the rate table. This is a manual review requirement, not a new monitor or scheduled job.
