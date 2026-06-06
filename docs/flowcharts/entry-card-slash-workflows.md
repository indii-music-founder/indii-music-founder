# Entry Card Slash Workflows

This flowchart maps the Universal Command Workflow Layer. The same command backbone handles dashboard cards, typed slash commands, mobile remote messages, voice/dictation text, future capture shortcuts, and custom slash commands promoted from useful Boardroom conversations.

```mermaid
graph TD
    Dashboard["Dashboard Entry Cards"] --> Registry["EntryCommandRegistry"]
    PromptArea["PromptArea Slash Input"] --> Registry
    MobileRemote["Mobile Remote Chat and Voice"] --> RemoteRelay["Remote Relay Desktop Listener"]
    RemoteRelay --> Registry
    CaptureSurface["Future Quick Capture Surface"] --> Registry
    Boardroom["Boardroom Conversation"] --> PromoteIntent["Turn This Into /command"]
    PromoteIntent --> Composer["Custom Command Composer"]
    Composer --> CustomStore["Custom Command Store"]
    CustomStore --> CloudSync["EntryCommandSyncService"]
    CloudSync --> UserCloud["entryCommands User Scope"]
    CloudSync --> TeamCloud["teamEntryCommands Team Scope"]
    UserCloud --> Registry
    TeamCloud --> Registry
    CustomStore --> Registry

    Registry --> Launcher["EntryCommandService"]
    Launcher --> StoreState["Agent UI Active Workflow State"]
    StoreState --> IntakeGate{"Required Intake Complete?"}

    IntakeGate -->|"No"| FollowUp["Guided Chat Follow-up"]
    FollowUp --> StoreState

    IntakeGate -->|"Yes: contact"| FieldContact["FieldContactService"]
    FieldContact --> FanCrm["fan_crm Harness Context"]

    IntakeGate -->|"Yes: merch"| MerchHarness["MerchPodHarnessService"]
    MerchHarness --> ApprovalGate["Approval Gate: Paid or Public Action"]

    IntakeGate -->|"Yes: custom"| CustomBrief["Saved Conversation Brief"]
    CustomBrief --> ApprovalGate

    IntakeGate -->|"Yes: workflow"| WorkflowRegistry["WorkflowRegistry and Orchestration"]
    WorkflowRegistry --> WorkflowState["workflowExecutions Persistence"]

    Launcher --> Transcript["Agent Chat Transcript"]
    ApprovalGate --> Transcript
    WorkflowState --> Transcript
    FanCrm --> Transcript

    Registry --> UnknownSlash{"Known Command?"}
    UnknownSlash -->|"No"| LegacyFallback["Existing Unknown Slash Fallback"]
    LegacyFallback --> AgentService["AgentService Normal Routing"]

    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#111827;
    classDef service fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#111827;
    classDef data fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#111827;
    classDef ai fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#111827;
    classDef gate fill:#fce4ec,stroke:#c2185b,stroke-width:2px,color:#111827;

    class Dashboard,PromptArea,MobileRemote,CaptureSurface,Transcript,Boardroom,PromoteIntent ui;
    class Registry,Launcher,RemoteRelay,FieldContact,MerchHarness,AgentService,Composer,CloudSync service;
    class StoreState,WorkflowState,FanCrm,CustomStore,CustomBrief,UserCloud,TeamCloud data;
    class WorkflowRegistry ai;
    class IntakeGate,ApprovalGate,UnknownSlash,LegacyFallback gate;
```

## Transition Breakdown

1. A workflow can start from a dashboard card, typed slash command, mobile remote message, dictated phone text, or a future capture shortcut.
2. `EntryCommandRegistry` resolves known commands and defines aliases, surfaces, intake fields, harness/workflow mappings, approval requirements, output contracts, and resume behavior.
3. Custom commands are stored separately from built-ins, saved locally first, and mirrored to user/team Firestore scopes when authenticated. Built-in slash names remain reserved.
4. `EntryCommandService` creates user-visible transcript messages, stores active intake state, extracts answers, and asks follow-up questions when required fields are missing.
5. `/save-command` and natural phrases like "turn what we just did into a workflow command called /shirt" summarize recent conversation context into a reusable command definition.
6. `/capture-contact` uses messy natural text to create a `FieldContactService` record under the user's field contacts. Only the name is required, and outreach remains approval-gated.
7. `/tour-merch` and custom merch commands compile a `merch_pod` harness quote with provider, product, cost, margin, and approval gates. They do not submit samples, orders, storefronts, SMS, or email.
8. Other command workflows collect structured context and can hand off to `WorkflowRegistry` and persisted `workflowExecutions` as their domain implementations deepen.
9. Unknown slash commands still fall back to the existing slash-command behavior, preserving previous developer workflows.
10. Normal chat bypasses the command layer unless a command workflow is actively collecting intake.
