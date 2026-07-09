# Cost of Doing Business — External Cost Ledger

Last updated: 2026-07-09
Owner: Founder / New Detroit Music LLC
Scope: third-party accounts, API usage, subscriptions, licenses, registrations, pass-through fees, and founder-only signups needed to build, run, release, distribute, monetize, or protect indii.

This is a working budget ledger, not accounting advice. Re-verify every amount at checkout because vendor pricing changes. USD unless noted.

## Known fixed / near-fixed baseline

These are the costs most likely to exist even before meaningful user volume.

| Cost center | Estimate | Cadence | Why it matters | Status / note | Source |
| --- | ---: | --- | --- | --- | --- |
| Apple Developer Program | $99 | Annual | macOS/iOS signing, notarization, TestFlight/App Store distribution | Needed for public Apple-platform release; org enrollment needs D-U-N-S | [Apple enrollment](https://developer.apple.com/programs/enroll/) |
| D-U-N-S Number | $0 | One-time | Required for Apple organization enrollment and business identity checks | Free path can take time; do not pay rush fee unless timing requires it | [Apple D-U-N-S help](https://developer.apple.com/help/account/membership/D-U-N-S/), [D&B](https://www.dnb.com/en-us/smb/duns.html) |
| Spotify Premium Individual | $12.99 | Monthly | Spotify account prerequisite / product testing / developer-account friction | Prior ledger said ~$12; current US public Premium page shows $12.99/mo after trial | [Spotify Premium US](https://www.spotify.com/us/premium/) |
| Windows signing — Azure Artifact Signing Basic | $9.99 | Monthly | Windows installer trust / Authenticode-style signing without third-party token cert | Preferred if eligibility works; Premium is $99.99/mo for larger signing volume | [Azure Artifact Signing](https://azure.microsoft.com/en-us/products/artifact-signing) |
| Windows signing — fallback CA certificate | ~$536+/yr | Annual | Fallback if Azure Artifact Signing eligibility fails | Sectigo OV starts at $536.25/yr on public page; DigiCert/SSL.com need recheck before buy | [Sectigo code signing](https://www.sectigo.com/ssl-certificates-tls/code-signing) |
| Google Play Console | $25 | One-time | Android publishing if mobile distribution becomes in scope | Optional unless Android/Play release is planned | [Google Play Console help](https://support.google.com/googleplay/android-developer/answer/6112435) |
| GitHub Team | $4/user | Monthly | Private repo collaboration, rules, reviews, Codespaces access | Free may be enough until org controls are needed | [GitHub pricing](https://github.com/pricing) |
| Codex / ChatGPT plan | $0+ | Monthly | Development labor multiplier, Codex tasks, model access | Codex is included in ChatGPT/Codex plans; budget separately from app runtime API spend | [Codex pricing](https://developers.openai.com/codex/pricing) |

Known fixed baseline if Apple + Spotify + Azure signing only: about **$31.23/month amortized** before GitHub/Codex and before usage-based APIs.

## AI, generation, and creative runtime costs

| Cost center | Estimate | Cadence | App surface | Control / risk note | Source |
| --- | ---: | --- | --- | --- | --- |
| Google Gemini API text/multimodal | Usage-based | Per token | Agents, RAG proxy, creative assistance, analysis | Put hard budgets and per-feature metering around any production endpoint | [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 3.1 image models | Usage-based | Per output token/image | Image generation and editing pages | Current public pricing includes low-cost Flash Lite image options; still must meter batch jobs | [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Veo 3.1 video generation | Usage-based | Per generated second | Veo 3.1 page and video endpoints | Very material cost: current public page lists Lite/Fast/Standard per-second rates; failed audio-processing generations are not charged per Google note | [Gemini API pricing - Veo](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini Omni Flash Preview | Usage-based | Per token / video second equivalent | Omni / video editing experiments | Preview model; cost and availability can change; gate behind founder/admin budgets | [Gemini API pricing - Omni](https://ai.google.dev/gemini-api/docs/pricing) |
| Lyria music generation | Usage-based | Per request | Music-generation experiments if enabled | Treat as experimental; log every request because it creates licensing/rights review needs too | [Gemini API pricing - Lyria](https://ai.google.dev/gemini-api/docs/pricing) |
| OpenAI API | Usage-based | Per token/tool use | Future app runtime agents, evals, founder assistants, OpenAI-backed tooling | Not currently the primary runtime found in env, but include for “building/maintaining Codex/agents” budget | [OpenAI API pricing](https://developers.openai.com/api/docs/pricing) |
| Codex usage credits / overages | Variable | Monthly | Development workflow, automated coding/review | Treat as founder/dev tooling, not COGS unless exposed to users | [Codex pricing](https://developers.openai.com/codex/pricing) |
| Remotion on Cloud Run / GCP | Usage-based | Build/render/runtime | Video rendering, creative exports | Costs come from Cloud Run, Cloud Storage, Artifact Registry, logs, egress, build minutes | [Google Cloud pricing](https://cloud.google.com/pricing), [Firebase pricing](https://firebase.google.com/pricing) |

Required controls before public launch:

- Hard daily/monthly budget alerts per Google Cloud billing account.
- Per-user and per-project generation quotas.
- Separate dev/test/prod API keys and billing labels.
- Store generated-media cost metadata with each render/job.
- Kill switch for Veo/Omni/image generation when budget is exceeded.

## Firebase / Google Cloud infrastructure

Local evidence: `.env.example`, `packages/firebase/src/config/secrets.ts`, and package dependencies show Firebase, Firestore, Storage, Functions, BigQuery, Cloud Tasks, Vertex/Gemini, Google Maps, YouTube/Google OAuth, Remotion Cloud Run, and Secret Manager usage.

| Cost center | Estimate | Cadence | Why it matters | Risk / control | Source |
| --- | ---: | --- | --- | --- | --- |
| Firebase Blaze / Google Cloud billing | Usage-based | Monthly | Firestore, Auth, Functions, Hosting, Storage, Remote Config, App Check, logs | Required for production functions/secrets; budget alerts mandatory | [Firebase pricing](https://firebase.google.com/pricing) |
| Firestore reads/writes/storage | Free tier then usage-based | Monthly | App data, ledgers, tasks, rights records | Watch chatty listeners and admin dashboards | [Firebase pricing](https://firebase.google.com/pricing) |
| Cloud Functions / Cloud Run | Free tier then usage-based | Monthly | Backend APIs, agents, webhooks, renders | Long-running render jobs and retries can spike | [Firebase pricing](https://firebase.google.com/pricing), [Google Cloud pricing](https://cloud.google.com/pricing) |
| Cloud Storage / Firebase Storage | Free tier then usage-based | Monthly | Audio, cover art, generated images/video, release packages | Media assets can dominate bill; lifecycle rules required | [Firebase pricing](https://firebase.google.com/pricing) |
| BigQuery | Usage-based | Monthly | Analytics/cost/audit data | Keep export retention and query budgets tight | [Google Cloud pricing](https://cloud.google.com/pricing) |
| Google Maps Platform | Pay-as-you-go by SKU | Monthly | Maps, routing, venue/campaign location features | Field masks, quotas, and SKU review required; old $200 monthly-credit assumptions are stale | [Maps pricing overview](https://developers.google.com/maps/billing-and-pricing/overview), [Maps pricing list](https://developers.google.com/maps/billing-and-pricing/pricing) |
| YouTube Data API / Google OAuth | Quota + possible verification/admin costs | Monthly / setup | YouTube upload, channel data, OAuth consent | API quota is not the same as OAuth verification readiness; track separately | [Google Cloud pricing](https://cloud.google.com/pricing) |
| Google Workspace / business email | TBD | Monthly | `info@indii.music`, OAuth testing, support inbox, founder identity | Add once exact Workspace/admin plan is chosen | [Google Workspace pricing](https://workspace.google.com/pricing.html) |

## Payments, subscriptions, merch, and commerce

| Cost center | Estimate | Cadence | App surface | Note | Source |
| --- | ---: | --- | --- | --- | --- |
| Stripe Payments | 2.9% + $0.30 domestic card | Per successful transaction | Checkout, subscriptions, founder passes, merch | Also track disputes, international cards, currency conversion, Connect, Tax, Radar if enabled | [Stripe pricing](https://stripe.com/pricing) |
| Stripe disputes | $15+ | Per dispute | All paid products | Budget as risk reserve, not normal operating cost | [Stripe pricing](https://stripe.com/pricing) |
| Printful Free | $0 + fulfillment/shipping/tax per order | Per order | Merchandise manufacturing/fulfillment | No monthly fee, but order cashflow hits before/around fulfillment | [Printful pricing](https://www.printful.com/pricing) |
| Printful Growth | $24.99 | Monthly | Merch margin improvement | Optional; free after $12K/year sales per Printful page | [Printful pricing](https://www.printful.com/pricing) |
| Shopify / ecommerce platform | TBD | Monthly | Direct-to-fan merch store if used | Not found as a configured dependency here, but likely if Printful store goes beyond custom checkout | Verify before adding |
| Domain registration / DNS | TBD | Annual | indii.music and related domains | Add registrar, renewal date, DNS provider, privacy fees | Verify registrar invoice |

## Social, marketing, email, and messaging APIs

| Cost center | Estimate | Cadence | App surface | Note | Source |
| --- | ---: | --- | --- | --- | --- |
| X API | Usage-based pay-per-use | Monthly | X/Twitter posting and analytics | Prior “Basic $200/mo” assumption is outdated; X now describes no subscription/minimum spend and pay-per-use pricing | [X API overview](https://docs.x.com/x-api/introduction), [X pricing](https://docs.x.com/x-api/getting-started/pricing) |
| Meta developer app | $0 direct fee / review labor | Setup + ongoing | Instagram/Facebook posting, Graph permissions | Existing blocker: SMS verification/rate limit; app review and business verification are the real costs | [Meta developers](https://developers.facebook.com/) |
| TikTok Content Posting API | $0 direct fee / approval labor | Setup + ongoing | TikTok posting | App must be approved for `video.publish`/`video.upload`; review can take days to two weeks | [TikTok Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started), [TikTok FAQ](https://developers.tiktok.com/doc/getting-started-faq) |
| Spotify developer app | $12.99/mo account + API approval/admin | Monthly + setup | Spotify analytics/artist-platform integrations | Premium account appears to be practical blocker; quota mode may need review | [Spotify Premium US](https://www.spotify.com/us/premium/) |
| Resend email API | Free tier then paid/overage | Monthly / usage | Transactional email | Existing code has `RESEND_API_KEY`; dedicated IP add-on is $30/mo if needed | [Resend pricing](https://resend.com/pricing) |
| Twilio SMS/MMS | Starts around $0.0083 per SMS segment in US + carrier fees | Usage | SMS verify/notifications if added | A2P 10DLC onboarding/fees can apply; prefer Firebase/Auth/provider-native flows if cheaper | [Twilio US SMS pricing](https://www.twilio.com/en-us/sms/pricing/us) |
| Apollo | $79+/seat/mo annual-plan public tier | Monthly / annual | Founder/sales intelligence if enabled | Code has `APOLLO_API_KEY`; external-use/data-resale needs separate terms | [Apollo pricing](https://www.apollo.io/pricing) |
| Clearbit / HubSpot enrichment | TBD / contact sales | Monthly / annual | Founder/sales intelligence if enabled | Code has `CLEARBIT_API_KEY`; pricing not safely public enough here; verify contract | Verify vendor |

## Rights, identifiers, licensing, and music-business registrations

These are founder/legal-business prerequisites. The app must store official identifiers; it must not generate these from fake/example prefixes.

| Cost center | Estimate | Cadence | Why it matters | Status / note | Source |
| --- | ---: | --- | --- | --- | --- |
| US ISRC Rights Owner Prefix | $95 | One-time | Official ISRC allocation for owned sound recordings/music videos | Needed if self-issuing ISRCs instead of importing distributor-assigned codes | [US ISRC Agency](https://usisrc.org/guidance-support/) |
| GS1 US single GTIN/UPC | $30 each | One-time | UPC/GTIN for releases/products where distributor/retailer does not provide one | Good for small count; no renewal for single GTIN | [GS1 US](https://www.gs1us.org/) |
| GS1 Company Prefix | Starts $250 + renewal | Initial + annual | Scalable UPC/GTIN ownership | Starts at 10 identifiers; annual renewal applies | [GS1 US prefix](https://www.gs1us.org/upcs-barcodes-prefixes/what-is-a-prefix) |
| DDEX Implementation Licence + DPID | $0 | Setup | Legitimate ERN/DDEX sender/receiver identity | Required before production DDEX delivery; DPID is org identifier | [DDEX licence/DPID](https://ddex.net/implementation/implementation-licence-and-ddex-party-identifiers/) |
| ASCAP writer | $0 | Setup | PRO performance royalties | Choose one PRO path; do not join multiple US PROs as the same writer | [ASCAP join](https://www.ascap.com/ome) |
| ASCAP publisher-only | $50 | One-time | Publishing-side PRO collection if not joining writer+publisher together | ASCAP waives publisher fee when joining as writer+publisher together per ASCAP help | [ASCAP music creators](https://www.ascap.com/music-creators) |
| BMI songwriter/composer | $0 | Setup | PRO performance royalties | Alternative to ASCAP; choose deliberately | [BMI FAQ](https://www.bmi.com/faq/entry/what_is_the_fee_to_join_as_a_songwriter) |
| BMI publisher | $175 individual / $250 LLC-corp / $500 partnership | One-time | Separate BMI publisher affiliation | Needed only if BMI path and publishing entity separation is desired | [BMI publisher FAQ](https://www.bmi.com/faq/entry/what_is_the_fee_to_form_a_publishing_company) |
| The MLC membership | $0 | Setup | US digital mechanical royalties for self-administered works | Free; does not replace PRO | [The MLC membership](https://www.themlc.com/membership) |
| SoundExchange registration | $0 | Setup | Digital performance royalties for sound recordings / featured artist / rights owner | Register performer and rights-owner roles as applicable | [SoundExchange register](https://www.soundexchange.com/register/) |
| U.S. Copyright Office registration | $45 / $65 / $85 common electronic routes | Per filing | Copyright registration for works/recordings/groups | Select correct PA/SR/group route; group album is currently $65 | [Copyright Office fees](https://www.copyright.gov/about/fees.html) |
| HFA Songfile mechanical licenses | $16/song service fee + statutory royalties; $14/song above five in transaction | Per cover/license | Cover-song mechanical licensing outside DSP-covered flows | Existing env references HFA; Songfile is for limited quantities and prepaid licenses | [HFA fee help](https://help.harryfox.com/does-songfile-have-any-fees), [Songfile FAQ](https://www.songfile.com/faq) |
| YouTube Content ID | TBD / eligibility | Setup + admin | Rights management / monetization enforcement | Direct access requires eligibility; distributor/admin route may have fees/revenue share | [YouTube Content ID eligibility](https://support.google.com/youtube/answer/1311402) |
| Meta Rights Manager | TBD / eligibility | Setup + admin | Rights protection on Facebook/Instagram | Apply from owned Page; likely labor/admin rather than direct public fee | [Meta Rights Manager overview](https://about.fb.com/news/2023/01/helping-creators-and-publishers-manage-intellectual-property/) |
| ISNI / artist IDs / platform IDs | TBD / usually assigned/imported | Setup | Identity/discovery identifiers | Track when assigned; do not block release unless a partner specifically requires it | Verify per authority/platform |

Founder choices still needed:

- Pick PRO path: ASCAP vs BMI vs SESAC/GMR invitation/commercial routes.
- Decide whether New Detroit Music LLC needs separate publisher affiliation now.
- Decide self-issued ISRC/GS1 path vs distributor-provided identifiers.
- Decide DDEX direct-delivery plan vs distributor/aggregator fallback.
- Decide Content ID / Rights Manager direct access vs distributor/admin route.

## Legal, contracts, signatures, and notarization

| Cost center | Estimate | Cadence | App surface | Note | Source |
| --- | ---: | --- | --- | --- | --- |
| PandaDoc Starter | $19/user/mo billed annually | Annual / monthly | Contracts, founder docs, signatures | Code uses `PANDADOC_API_KEY`; API appears Enterprise-gated on pricing page, so confirm before relying on Starter | [PandaDoc pricing](https://www.pandadoc.com/pricing/) |
| PandaDoc Business | $49/seat/mo billed annually | Annual / monthly | Contracts/workflows | Business unlocks more workflow/security features; API still likely needs Enterprise | [PandaDoc pricing](https://www.pandadoc.com/pricing/) |
| PandaDoc Notary | Starts $69/user/mo + $10 transaction, or $25/transaction using their notaries | Monthly + per transaction | Notarized founder/legal documents | Only needed if remote online notarization enters workflow | [PandaDoc Notary pricing](https://notary.pandadoc.com/pricing/) |
| DocuSign | TBD | Monthly / annual | E-sign alternative | `.env.example` has DocuSign placeholders; choose one e-sign provider to avoid duplicate spend | [DocuSign pricing](https://www.docusign.com/products/electronic-signature/pricing) |
| Outside counsel / accountant | TBD | Hourly / retainer | Music rights, terms, tax, entity, contracts | Not a software fee but should be budgeted before paid public launch | Founder to source |

## Web3 / blockchain / NFT-adjacent costs

Local evidence: `.env.example` includes Alchemy, ETH RPC, OpenSea, Pinata, WalletConnect, Unstoppable Domains, SongShares provider/wallet.

| Cost center | Estimate | Cadence | App surface | Note | Source |
| --- | ---: | --- | --- | --- | --- |
| Alchemy | Free 30M CU/mo; PAYG starts around $0.45/1M CU | Monthly / usage | ETH RPC / web3 reads/writes | Production chain usage and archive/index calls can exceed free tier | [Alchemy pricing](https://www.alchemy.com/pricing) |
| Pinata | $0 / $20 / $100 tiers | Monthly | IPFS/media pinning | Free is 1GB; Picnic is $20/mo; Fiesta is $100/mo | [Pinata pricing](https://pinata.cloud/pricing) |
| OpenSea API | API key + marketplace/gas costs | Usage / transaction | NFT marketplace data/actions | API key itself may not be the main cost; chain gas and marketplace fees are | [OpenSea API docs](https://docs.opensea.io/reference/api-overview), [OpenSea fees](https://docs.opensea.io/docs/opensea-fees) |
| WalletConnect / Reown project ID | TBD / likely free starter | Monthly / usage | Wallet connections | Add exact plan if production dashboard requires paid tier | [WalletConnect dashboard note](https://walletconnect.com/blog/meet-the-new-walletconnect-dashboard) |
| Unstoppable Domains API/domains | Domain-price based | Per domain / renewal as applicable | Web3 identity/domain automation | API exposes domain search/registration; actual cost is domain purchase/renewal | [Unstoppable API](https://unstoppabledomains.com/en-us/products/api) |
| Network gas fees | Variable | Per transaction | Minting, split contracts, wallet actions | Must be shown to user/founder before chain writes | Chain explorer / wallet quote |

## Observability, automation, and reliability

| Cost center | Estimate | Cadence | App surface | Note | Source |
| --- | ---: | --- | --- | --- | --- |
| Sentry | $0 developer; Team/Business paid tiers | Monthly / annual | Error monitoring, release health | Code has Sentry package/env; set event quotas to avoid surprise | [Sentry pricing](https://sentry.io/pricing/), [Sentry pricing docs](https://docs.sentry.io/pricing/) |
| Inngest Hobby | $0 | Monthly | Durable workflows / background jobs | Local code uses Inngest; Hobby includes limited executions/concurrency | [Inngest pricing](https://www.inngest.com/pricing) |
| Inngest Pro | Starts $99/mo | Monthly | Production workflows | Needed if executions, concurrency, users, workers, tracing exceed Hobby | [Inngest pricing](https://www.inngest.com/pricing) |
| GitHub Actions / Codespaces / Packages | Free tier then usage | Monthly | CI/CD, builds, packages | Codespaces starts with usage pricing inside GitHub pricing; add budgets if used | [GitHub pricing](https://github.com/pricing) |

## Audio recognition / licensing-adjacent APIs

| Cost center | Estimate | Cadence | App surface | Note | Source |
| --- | ---: | --- | --- | --- | --- |
| ACRCloud | Free trial / contact sales | Monthly / usage | Audio fingerprinting, recognition, metadata | Env has ACRCloud placeholders; public product page points to trial/contact sales rather than stable public rates | [ACRCloud](https://www.acrcloud.com/), [Music recognition](https://www.acrcloud.com/music-recognition/) |
| AudD alternative | $45/stream/mo published stream plan | Monthly | Possible audio recognition alternative | Not currently configured; listed as comparison/fallback if ACRCloud pricing is opaque | [AudD](https://audd.io/) |

## Required ledger fields for every cost before launch

Each external account should have a row or linked record with:

- Vendor/account URL
- Legal owner name
- Billing email
- Payment method owner
- Renewal date
- Monthly/annual cap
- API key/secret storage location
- App features depending on it
- Cancellation path
- Data-processing / privacy terms status
- Whether cost is fixed, usage-based, transaction-based, or pass-through

## Open budget risks

| Risk | Why it can get expensive | Required mitigation |
| --- | --- | --- |
| Veo / video generation loops | Per-second generated video costs compound quickly during retries and preview workflows | Admin-only launch, low daily cap, visible per-job cost estimate, store cost metadata |
| Image generation/editing retries | Batch variants and failed UX loops can multiply spend | Per-user quota, max variants, cache successful outputs |
| Firestore listener/query fan-out | Real-time dashboards can create high read volume | Query budgets, aggregation docs, emulator/load tests |
| Media storage and egress | Audio/video assets are large and repeatedly downloaded | Lifecycle rules, signed URL expiry, CDN/cache review |
| Google Maps Places/Routes | Wrong SKU/field masks can turn small UX into large bill | Field masks, SKU review, quotas |
| Stripe disputes/refunds | Fraud/chargebacks create direct fees and support labor | Radar rules, refund policy, dispute playbook |
| X API changes | Pricing model has already moved away from fixed Basic assumptions | Feature flag, live pricing recheck before enabling |
| Rights/licensing mistakes | Wrong identifiers or missing registrations create legal/revenue risk, not just software bugs | Founder Readiness record, official evidence uploads, no locally invented identifiers |

## Immediate founder action list

1. Apple Developer org enrollment: confirm D-U-N-S, then pay $99/year.
2. Spotify Premium on the business/test account: budget $12.99/month.
3. Windows signing: try Azure Artifact Signing Basic first; keep Sectigo/DigiCert/SSL.com as fallback.
4. Decide PRO/publisher path before recording official IPI/IP-name data.
5. Apply for US ISRC prefix if self-issuing recordings; otherwise require distributor-provided ISRC import.
6. Choose GS1 single GTIN vs Company Prefix for UPC/GTIN ownership.
7. Get DDEX Implementation Licence/DPID before direct production DDEX delivery.
8. Enable GCP/Firebase budget alerts before any public generation endpoints.
9. Add hard app-side quotas for Gemini, Veo, Omni, Remotion, Maps, and OpenAI-backed jobs.
10. Choose one e-sign provider; do not keep PandaDoc and DocuSign paid in parallel unless both are actually needed.
