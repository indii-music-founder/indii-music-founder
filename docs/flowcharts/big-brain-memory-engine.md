# BigBrain memory assembly and write receipts

This map describes the inspected context-assembly and explicit memory-write paths.
Stored content is not automatically verified truth. Local structural tests do not
establish deployed persistence, future recall, or full memory continuity.

```mermaid
flowchart TD
    Input["BigBrainEngine.assembleContext: user, agent and message"] --> Parallel["Four bounded fetches through Promise.allSettled"]
    Parallel --> Daily["Captain's Log daily summary"]
    Parallel --> Vault["Core Vault facts for this agent"]
    Parallel --> Recall["Semantic ranked page plus recent Always-On memories"]
    Parallel --> Rules["Semantic page filtered for preference/rule wording"]
    Daily --> Bundle["Context bundle, character counts and layer errors"]
    Vault --> Bundle
    Recall --> Bundle
    Rules --> Bundle
    Bundle --> Format["formatForPrompt: daily context, authoritative-facts tag and cross-session recall"]
    Bundle --> Alignment["ContextPipeline forwards alignmentRules as userAlignmentRules"]
    Alignment --> PromptRules["AgentPromptBuilder adds the user alignment section"]
    Recall -. "Unavailable search reports its limited scope" .-> Bundle
```

```mermaid
flowchart TD
    Tool["Explicit memory-write tool"] --> Kind{"Primary engine save or semantic index?"}
    Kind -->|"save_memory / save_user_memory"| Engine["AlwaysOnMemoryEngine.ingestWithReceipt"]
    Engine --> Pipeline["MemoryIngestionPipeline: extract and persist primary memory"]
    Pipeline --> Check["Validate stored ID and unchanged engine owner"]
    Pipeline -. "Secondary index sync is best effort" .-> Proxy["manageSemanticMemory authenticated backend"]
    Kind -->|"index_memory"| Bank["MemoryBankService.addMemory"]
    Bank --> Proxy
    Proxy --> Ack["Validate nonempty persisted IDs and memory records"]
    Check --> Status{"Stored, skipped or unconfirmed?"}
    Ack --> Status
    Status -->|"Stored receipt"| Saved["Return actual memory reference; claim saved"]
    Status -->|"Skipped"| Skipped["No new memory saved; do not report success"]
    Status -->|"Unconfirmed / lost response"| Unknown["Check memory before retrying; do not claim failed write certainty"]
    Skipped --> Halt["BaseAgent stops this write instead of requesting another model attempt"]
    Unknown --> Halt
```

## Transition Breakdown

- `BigBrainEngine.assembleContext` fetches four sources with independent character
  budgets and collects rejected layer errors. Its formatter includes three text
  sections; alignment rules remain a separate field forwarded by ContextPipeline to
  AgentPromptBuilder. This diagram does not claim that every application entry
  point consumes every field.
- Semantic recall uses one ranked page and reports its scope, then supplements it
  with recent Always-On memories. A successful empty page differs from an
  unavailable search; neither proves every historical memory was checked.
- The primary ingestion pipeline returns a stored ID, a skip, or failure data.
  Explicit save tools consume the engine's structured receipt rather than parsing
  presentation strings. A changed engine owner invalidates the active receipt.
- Semantic indexing uses the authenticated callable; client-side user IDs are
  not forwarded as backend ownership authority. Missing/malformed save receipts
  and rejected requests are not converted into successful empty writes.
- A primary save receipt does not prove secondary indexing or later retrieval.
  Unknown outcomes are not automatically repeated because a lost response may
  follow a successful write. Cross-restart reconciliation and indexing backfill
  remain open.

Sources: `packages/renderer/src/services/agent/memory/BigBrainEngine.ts`,
`AlwaysOnMemoryEngine.ts`, `MemoryIngestionPipeline.ts`, `MemoryBankService.ts`,
`packages/renderer/src/services/agent/tools/MemoryTools.ts`, and
`packages/firebase/src/functions/agent/manageSemanticMemory.ts`,
`packages/renderer/src/services/agent/components/ContextPipeline.ts`, and
`packages/renderer/src/services/agent/builders/AgentPromptBuilder.ts`.
