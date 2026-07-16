# Inter-Agent Data Access Architecture

## Principle
An agent should NOT have direct access to another domain's data, but SHOULD be able to *request* it from the agent that owns it.

- Agents receive tools to retrieve records only for their **OWN** domain collections.
- For data outside their domain, agents MUST use `consult_specialist(domain, request)` via the A2A (Agent-to-Agent) swarm loop.

## Domain Ownership Map

| Agent | Domain Collections / Data Ownership |
| :--- | :--- |
| **CreativeAgent** | `generated_images`, `brandAssets`, `referenceImages`, `uploadedImages` |
| **FinanceAgent** | `revenue`, `expenses`, `payouts`, `users/{uid}/ledger` |
| **MerchandiseAgent**| `merchandise`, `print_jobs`, `merchandise_inventory` |
| **MarketingAgent** | `campaigns`, `scheduledPosts`, marketing assets |
| **PublicistAgent** | `publicist_campaigns`, press releases, media contacts |
| **DistributionAgent**| `ddexReleases`, `proprietaryIngestionReleases`, `distribution_tasks` |
| **LegalAgent** | `contracts`, legal entity data |
| **LicensingAgent** | `licensing_clearances`, `licenses` |
| **PublishingAgent** | Publishing works, PRO catalogs |
| **RoadAgent** | Tours, itineraries, hospitality riders (shared with Hospitality) |
| **SocialAgent** | Social post drafts, analytics, community webhooks |
| **MusicAgent** | Track metadata, audio analysis data, splits |
| **VideoAgent** | Video projects, generated videos |
| **EventPlannerAgent**| Events, bookings |

## Verification and Rules

1. **Strict Tool Boundaries**: Tools mapped to an agent must only read from that agent's domain.
2. **Prompts & Confabulation**: Prompts must instruct agents to use `consult_specialist` when they need cross-domain information, rather than confabulating or attempting to directly access databases they don't own.
3. **Honest Dead-ends**: If a `consult_specialist` request cannot be fulfilled by the target agent, the target agent must honestly report that it lacks the data, and the requesting agent must pass this limitation to the user.

*(See ISSUE-1057 and ISSUE-1056 in OPEN_ISSUES.md for tracking the rollout of these rules.)*
