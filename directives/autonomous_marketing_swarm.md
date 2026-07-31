# Directive: Autonomous Marketing Swarm

## 🎯 Primary Goal

Let marketing agents buy ads on an artist's behalf without ever letting them
spend money the artist did not authorize, on creative the artist would not
approve.

The artist is a solo independent act. There is no media buyer to catch a
runaway campaign, and there is no budget to absorb one.

## 📋 Standard Operating Procedure

### Phase 1: Creative Generation (Layer 2)

1. Generate the ad creative from the campaign brief and the artist's Brand Kit.
2. **HARD GATE — Brand QC**: run `runCreativeVisionCheck`
   (`packages/renderer/src/services/agent/governance/BrandVisionQC.ts`) against
   the creative before it goes anywhere near an ad account.
   * A rejection is final for that asset. Regenerate; never override.
   * The check fails closed. An unavailable model means *no publish*, not a
     silent pass.
   * Log the rejection as `vision_qc_failed` so the artist sees the agent
     caught it.

### Phase 2: Publication (Layer 3)

1. Publish only through `pushAdCreative`
   (`packages/firebase/src/marketing/facebookAdsExecutor.ts`).
2. Never call the Meta Graph API from anywhere else. The executor is the only
   sanctioned path and is structurally write-only — see Constraints.
3. The Facebook Page ID and access token come from the artist's stored Meta
   connection. Never hardcode either; Meta rotates both.

### Phase 3: Optimization

1. Read performance from the ClickHouse rollup via
   `marketingGetCampaignMetrics` — never by polling Meta.
2. When a creative's CPA exceeds the campaign bound, call `pauseAd` with a
   reason the artist can read.
3. Pausing is always permitted, including while the swarm is halted. Reducing
   spend is never gated.

### Phase 4: Accountability

Every action writes to both audit surfaces (`recordAgentAction`):

| Surface | Who reads it |
| --- | --- |
| `users/{uid}/marketingAgentLogs` | The artist, live, in Swarm Command Center |
| `timelineExecutionLogs` | Operators — immutable, no client access |

An action the artist cannot see did not happen as far as trust is concerned.

## 🚧 Constraints

### Write-only Meta access

The executor may only POST to the publish/pause allowlist. Read traffic against
the Marketing API gets ad accounts banned, and it is the artist's account at
risk, not ours. Analytics arrives through Airbyte → ClickHouse
(`warehouse/README.md`). **Adding a read endpoint to
`WRITE_ENDPOINT_ALLOWLIST` is a policy violation, not an optimization.**

### The halt switch is real

`users/{uid}/settings/marketingSwarm` → `isActive: false` blocks every
spend-increasing write server-side. The Command Center button writes that doc
and only moves once the write lands. Agents must not cache the flag or treat a
failed read as permission to spend.

### Budget bounds

Campaign budget and CPA ceiling belong to the campaign record, not to agent
judgment. An agent may pause below a ceiling; it may never raise one.

## ✅ Success Criteria

- No ad reaches a live account without a passing brand QC verdict.
- Halting the swarm stops new ad buys within one agent tick.
- Every published or paused ad appears in the artist's log with a reason.
- Meta read traffic from indii stays at zero.
