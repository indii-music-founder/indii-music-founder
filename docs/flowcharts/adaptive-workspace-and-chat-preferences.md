# Adaptive Workspace and Chat Preferences Flowchart

This map describes how the global Studio shell protects usable module space, preserves the user's navigation-panel choices, adapts department dashboards to their actual container width, and applies the Cognitive Logic preference to every compatible chat message.

```mermaid
flowchart LR
    User["User opens or closes navigation panels, resizes chat, opens a department, or changes Appearance settings"]
    Shell["AppShell: Sidebar + module workspace + RightPanel"]
    SidebarGroups["Sidebar groups: Intelligence & Automations, Projects Dropdown, Manager's Office, Departments, Bottom Rail Dock"]
    SidebarState["Section disclosure states: initially closed"]
    ProjectLanding["Projects dropdown lands on Project Canvas [Spatial Canvas | File Explorer]"]
    BottomRail["Persistent Bottom Rail Dock: User Identity, Quick Notes (⌘J), Settings Modal (⌘,)"]
    Budget["Workspace width budget"]
    RightPanel["RightPanel preferred width and effective width"]
    PanelToggle["Right-panel toggle or rail tab"]
    PanelState["AppSlice isRightPanelOpen"]
    PanelStorage["Local storage: indii_rightPanelOpen"]
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
    Shell --> SidebarGroups
    SidebarGroups --> SidebarState
    SidebarGroups --> ProjectLanding
    SidebarGroups --> BottomRail
    User --> BottomRail
    User --> PanelToggle
    PanelToggle --> PanelState
    PanelState --> PanelStorage
    PanelStorage --> PanelState
    PanelState --> RightPanel
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
    class Shell,SidebarGroups,ProjectLanding,BottomRail,RightPanel,PanelToggle,Workspace,Rails,Content,Appearance,ChatMessage,Thought,Boardroom ui
    class SidebarState,Budget,PanelState,Mode,Profile logic
    class PanelStorage,Storage data
```

## Step-by-Step Transition Breakdown

1. The Sidebar mounts the elevated Swarm Intelligence & Automations cluster (Boardroom, Agent Canvas, Workflow Builder, Knowledge Base), the Projects dropdown (which lands directly on Project Canvas with a `[ Spatial Canvas | File Explorer ]` header switcher), Manager's Office, and Departments with section disclosures closed. The legacy Tools catch-all accordion in the sidebar has been retired; Settings is now accessed via the persistent Sidebar Bottom Rail / Footer Dock (`Cmd+,` floating overlay modal) and Notes via the Global Quick-Capture Drawer (`Cmd+J` or bottom dock trigger) plus native `NoteBlock` elements on Project Canvas.
2. The right-panel toggle updates `AppSlice.isRightPanelOpen` and writes the same boolean to `indii_rightPanelOpen`. On the next app launch, `createAppSlice` restores that value, so the user’s last open or closed choice remains stable.
3. The right rail remains visible whether the content panel is open or closed. Selecting a rail tab persists `true`, opens that tab when needed, and switches the content in place when already open. Ordinary module navigation does not write the visibility preference, so it cannot override the user’s choice.
4. `AppShell` calculates the space shared by the global Sidebar, module workspace, and RightPanel. The RightPanel retains the user’s preferred width but uses an effective width that cannot collapse the module below a readable budget.
5. `AdaptiveWorkspace` measures its own width, rather than consulting the browser viewport, then selects wide, standard, or focused mode. Secondary rails become drawers before the main workspace is squeezed.
6. Modules—including the customizable Dashboard—use the selected mode and container queries to reflow grids, spacing, titles, KPIs, controls, and artifacts from one to three columns according to their actual workspace width. No whole-page CSS transform is used.
7. Appearance settings update the existing user-profile preference object. `ProfileSlice` persists it locally and merges it to the user’s Firestore document.
8. `ChatMessage` uses the stored Cognitive Logic preference only when a thought card mounts, so manual expansion or collapse remains under the user’s immediate control. Boardroom’s custom renderer receives the same behavior when it has thought data.

The gate between the width budget and persistent rails is the important protection: a secondary panel must yield before a department’s center content becomes an unreadable sliver.
