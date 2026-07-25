# Adaptive Workspace and Chat Preferences Flowchart

This map describes how the global Studio shell protects usable module space, how a department dashboard adapts to its actual container width, and how the Cognitive Logic preference reaches every compatible chat message.

```mermaid
flowchart LR
    User["User resizes chat, opens a department, or changes Appearance settings"]
    Shell["AppShell: Sidebar + module workspace + RightPanel"]
    Budget["Workspace width budget"]
    RightPanel["RightPanel preferred width and effective width"]
    Workspace["AdaptiveWorkspace container"]
    Mode["Workspace mode: wide, standard, or focused"]
    Rails["Persistent rails or accessible drawers"]
    Content["Module content: grids, type, controls, artifacts"]
    Profile["ProfileSlice user preferences"]
    Storage["IndexedDB profile and Firestore users/{uid}"]
    Appearance["Settings Appearance section"]
    ChatMessage["Shared ChatMessage renderer"]
    Thought["ThoughtChain default open state"]
    Boardroom["BoardroomConversationPanel thought rendering"]

    User --> Shell
    Shell --> Budget
    Budget --> RightPanel
    Budget --> Workspace
    Workspace --> Mode
    Mode --> Rails
    Mode --> Content
    User --> Appearance
    Appearance --> Profile
    Profile --> Storage
    Profile --> ChatMessage
    ChatMessage --> Thought
    Profile --> Boardroom
    Boardroom --> Thought

    classDef user fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    classDef ui fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    classDef logic fill:#e8f5e9,stroke:#39FF14,stroke-width:2px
    classDef data fill:#fff3e0,stroke:#ff8c00,stroke-width:2px

    class User user
    class Shell,RightPanel,Workspace,Rails,Content,Appearance,ChatMessage,Thought,Boardroom ui
    class Budget,Mode,Profile logic
    class Storage data
```

## Step-by-Step Transition Breakdown

1. `AppShell` calculates the space shared by the global Sidebar, module workspace, and RightPanel. The RightPanel retains the user’s preferred width but uses an effective width that cannot collapse the module below a readable budget.
2. `AdaptiveWorkspace` measures its own width, rather than consulting the browser viewport, then selects wide, standard, or focused mode. Secondary rails become drawers before the main workspace is squeezed.
3. Modules use the selected mode and named container queries to reflow grids, spacing, titles, KPIs, controls, and artifacts. No whole-page CSS transform is used.
4. Appearance settings update the existing user-profile preference object. `ProfileSlice` persists it locally and merges it to the user’s Firestore document.
5. `ChatMessage` uses the stored Cognitive Logic preference only when a thought card mounts, so manual expansion or collapse remains under the user’s immediate control. Boardroom’s custom renderer receives the same behavior when it has thought data.

The gate between the width budget and persistent rails is the important protection: a secondary panel must yield before a department’s center content becomes an unreadable sliver.
