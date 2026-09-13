# Instagram Growth and Ingestion Contract

Status: implementation contract  
Policy owner: indii  
Policy version: 2026-09-13

## Publishing

| Surface | Required pixels | Ratio | Duration | Hashtags |
| --- | ---: | ---: | --- | --- |
| Feed / carousel | 1080x1350 | 4:5 | n/a | 3-5 specific tags |
| Reel — discovery | 1080x1920 | 9:16 | under 15 seconds | 5-8 targeted tags at caption end |
| Reel — nurture | 1080x1920 | 9:16 | over 30 seconds | 5-8 targeted tags at caption end |
| Story | 1080x1920 | 9:16 | maximum 15 seconds per segment | no product quota |
| Live | 1080x1920 | 9:16 | maximum 60 minutes | no product quota |

These are indii product guardrails, not representations of every maximum Meta may accept. Story payloads over 15 seconds require numbered media segments whose durations completely cover the source duration. Standard Story TTL is recorded as 24 hours; Story Extend records 48 hours.

The shared contract is exported from `@indii/shared`. Renderer and Cloud Function entry points both validate it. Instagram queue records without validated metadata fail closed instead of being published with guessed media properties.

## Messaging and commerce

Only signed Meta webhook events can create reply eligibility. Eligible sources are an inbound message, Story reply, or reaction. Outbound echoes, follow events, unknown events, expired events, account mismatches, and already-claimed events cannot authorize a DM.

The OAuth connection stores a server-owned channel registry and confirms the webhook subscription. Shop purchase or intent events create a CRM lead under the owning artist. Follow-up status begins as `pending_review`; automated welcome messages remain disabled.

Customer identifiers remain in the protected CRM document so a legitimate follow-up can be reconciled. The UI exposes a masked identifier and clients cannot write webhook, inbox, registry, or CRM ingestion records.

## Measurement

Unified Views is the primary content KPI. Each value retains provenance:

- `views`: provider-reported Views;
- `plays_legacy`: provider plays used as an explicitly labeled legacy fallback;
- `impressions_legacy`: impressions proxy when Views is unavailable;
- `unavailable`: no substitute is fabricated.

Reel engagement percentage is:

\[
\frac{likes + shares + comments}{Views} \times 100
\]

No percentage is returned when Views is zero or unavailable. Verified DM shares receive 45% of the normalized distribution score. Aggregate shares may substitute only with the label `All shares (DM-share proxy)`.

## Agent behavior

Agents prioritize searchable descriptions, intent, profile text, bios, and alt text. Trend-audio work requires an observed audio identifier and source metadata. Image briefs use one central focal point, human presence, and restrained blue accents; any claimed blue uplift remains an A/B-test hypothesis.

Trial Reels, Close Friends, interactive Story stickers, Collabs, and Facebook sync are recommendations or manual/provider-dependent actions unless the runtime exposes a verified tool. Regional morning and weekend scheduling must be supported by the artist's own audience-activity data.

## Operational prerequisites

- `META_APP_SECRET` validates webhook signatures.
- `META_WEBHOOK_VERIFY_TOKEN` validates Meta webhook setup.
- Meta app permissions and webhook fields must be approved for the connected professional account.
- Production delivery and live-user behavior require genuine account authorization; deterministic tests prove only local policy logic.
