# Implementation Plan - Universal Command Workflow Layer

## Prior State
The previous active artifact described a completed `/proceed` audit cleanup. This file supersedes it as the active source of truth for agents working on the command workflow project.

## Goal
Create a reusable `/command` workflow layer that turns repeatable artist/business moments into guided, resumable workflows. The first surfaces are dashboard cards, typed slash commands, mobile remote chat, and user-promoted custom commands from successful Boardroom conversations. The first operational workflows are contact capture, tour merch quote/approval planning, and conversation-to-command promotion.

## Architecture
- `EntryCommandRegistry` defines slash aliases, surfaces, intake fields, harness/workflow links, approval requirements, output contracts, and resume behavior.
- Custom commands are stored separately from built-in commands, resolve through the same registry API, and cannot override reserved built-in slash names.
- Custom commands save locally first, then sync to Firestore when a signed-in user is available:
  - User scope: `entryCommands/{uid_commandId}` with `ownerId` and `scope: "user"`.
  - Team scope: `teamEntryCommands/{orgId_commandId}` with `orgId`, `ownerId`, and `scope: "team"`.
- `EntryCommandService` handles command launch, active intake continuation, chat transcript messages, field contact persistence, and merch harness compilation.
- `EntryCommandService` also handles `/save-command` and natural phrases such as "turn what we just did into a workflow command called /shirt" by distilling recent agent/Boardroom context into a reusable custom command.
- Agent UI state tracks the active command workflow with collected answers, missing fields, harness/workflow IDs, status, and timestamps.
- Dashboard cards, `PromptArea`, and mobile remote relay all route through the command service before normal agent chat.
- Existing business systems remain the source of truth:
  - `fan_crm` and `FieldContactService` for contact capture.
  - `merch_pod` and `MerchPodHarnessService` for tour merch quote/approval planning.
  - Existing workflow registry definitions for campaign, tour, and release-adjacent flows.

## Implementation Steps
1. Add command registry and active workflow state.
2. Add command launcher service with guided intake, contact capture, and merch quote handlers.
3. Wire dashboard cards and entry assistant actions to slash commands.
4. Intercept known slash commands in `PromptArea`; preserve unknown slash fallback.
5. Intercept known slash commands in mobile remote desktop relay; preserve normal mobile chat.
6. Add custom command promotion from recent conversation context.
7. Add cloud/team sync for custom commands with local fallback and Firestore security rules.
8. Add focused registry, service, sync, static rules, and emulator rules tests.
9. Document the command workflow architecture in `docs/flowcharts/entry-card-slash-workflows.md` and `docs/flowcharts/custom-command-cloud-sync.md`.

## Safety Rules
- Do not touch CI, merge, cleanup, or unrelated concurrent-agent work.
- Do not execute paid, public, irreversible, email, SMS, production, storefront, or distribution actions without explicit user approval.
- Do not claim live provider fulfillment works unless credentials and provider API paths are configured and verified.
- If unrelated defects are discovered, record them in the open issues ledger instead of diverting.

## Acceptance Criteria
- Dashboard cards launch command workflows instead of canned prompts.
- Typed known slash commands are handled locally; unknown slash commands keep legacy fallback.
- Mobile remote slash commands use the same command service as desktop.
- `/capture-contact` saves structured field contacts from messy natural input and asks follow-up when no contact method is present.
- `/tour-merch` compiles a merch POD harness quote and surfaces approval gates without executing paid/public actions.
- A user can promote a useful conversation into a custom command such as `/shirt`; the saved command resolves like built-ins and preserves approval gates.
- Custom commands remain available locally offline and sync across user/team Firestore scopes when authenticated.
- Normal non-command chat still reaches `agentService.sendMessage`.
