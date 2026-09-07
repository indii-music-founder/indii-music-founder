---
description: Comprehensive topological flow mapping every interactive button, trigger, and control surface across indii.music down to deterministic handlers, store mutations, and view destinations.
---

# Button Action & Navigation Flowchart

Comprehensive flow mapping interactive button surfaces across indii.music through state handlers and store mutations to their terminal destinations, incorporating the redundancy elimination refactor.

```mermaid
flowchart TD
    subgraph UI_Surfaces ["1. UI Entry Surfaces"]
        direction TB
        subgraph GlobalShell ["Global Shell & Navigation"]
            B1["return-hq-btn"]
            B2["sidebar-toggle"]
            B3["sidebar-biometric-toggle"]
            B4["sidebar-command-menu-trigger (⌘K)"]
            B5["sidebar-agent-canvas-toggle"]
            B6["boardroom-mode-toggle"]
            B7["founders-checkout-button"]
            B8["nav-item-items"]
            B9["bottom-rail-notes-btn (⌘J Quick-Capture)"]
            B10["bottom-rail-settings-btn (⌘, Settings Modal)"]
            B11["project-dropdown-select (Project Landing)"]
            B12["workspace-switcher-toggle [Spatial Canvas | File Explorer]"]
            B13["sidebar-workflow-builder-btn (Swarm Intelligence)"]
            B14["sidebar-knowledge-base-btn (Swarm Intelligence)"]
            B15["rightpanel-knowledge-slideover (Cross-Dept Access)"]
        end

        subgraph CommandBarSurfaces ["Command Bar & Prompts"]
            C1["talk-button Idle"]
            C2["command-bar-stop-btn Busy"]
            C3["knowledge-grounding-toggle RAG"]
            C4["attachment-trigger"]
            C5["chat-collapse-btn"]
        end

        subgraph OmniPanelSurfaces ["Right Omni-Panel"]
            P1["right-panel-toggle"]
            P2["panel-tab-approvals"]
            P3["panel-tab-artifacts"]
            P4["panel-tab-assets"]
            P5["toggle-creations-btn"]
            P6["view-toggle-archives Chat Archives"]
        end

        subgraph DialogSurfaces ["Standalone Dialogs react-call"]
            D1["ConfirmDialog Confirm Cancel"]
            D2["AlertDialog OK"]
            D3["PromptDialog Submit Cancel"]
        end

        subgraph DepartmentAndStudioSurfaces ["Department, Studio & Canvas Surfaces"]
            S1["creative-nav-back-module Exit"]
            S2["creative-nav-back-view History"]
            S3["creative-nav-forward-view Next"]
            S4["canvas-mode-canvas video"]
            S5["canvas-export"]
            S6["import-track-preflight-input (Distribution QC)"]
            S7["save-preflight-analysis-button (Distribution QC)"]
            S8["releases-submit-button (DDEX ERN)"]
            S9["upload-royalty-statement-btn (Finance Forensics)"]
            S10["dept-recipe-card-run-btn (1-Click Workflow)"]
            S11["canvas-noteblock-create (Native NoteBlock)"]
        end
    end

    subgraph State_Handlers ["2. Handlers & Store Mutations"]
        direction TB
        H1["setModule dashboard"]
        H2["setSidebarCollapsed toggle"]
        H3["toggleBiometricStatus"]
        H4["setCommandPaletteOpen true"]
        H5["toggleCanvas setModule agent-space"]
        H6["toggleBoardroomMode"]
        H7["onFounderUpgrade"]
        H8["throttledSetModule id"]
        H9["setQuickNotesOpen toggle"]
        H10["setSettingsOpen toggle"]
        H11["setSelectedProject setModule project-canvas"]
        H12["setModule ('files' | 'project-canvas')"]
        H13["throttledSetModule workflow"]
        H14["throttledSetModule knowledge"]
        H15["setRightPanelTab knowledge"]

        HC1["startVoiceInput Web Speech API"]
        HC2["cancelActiveTask AbortSignal"]
        HC3["toggleKnowledgeBase RAG Grounding"]
        HC4["fileInputRef.current.click"]
        HC5["setCommandBarCollapsed toggle"]

        HP1["setRightPanelOpen toggle"]
        HP2["setActiveTab approvals"]
        HP3["setActiveTab artifacts"]
        HP4["setActiveTab assets"]
        HP5["toggleCreationsDrawer"]
        HP6["setView archives"]

        HD1["call.end true false"]
        HD2["call.end"]
        HD3["call.end text null"]

        HS1["goBackModule Prior Module"]
        HS2["viewModeBack Prior View"]
        HS3["viewModeForward Next View"]
        HS4["setGenerationMode canvas or video"]
        HS5["onExport format scale"]
        HS6["handlePreFlightQC (Essentia + LUFS Metering)"]
        HS7["handlePushToDistributionQC (QCPanel)"]
        HS8["handleSubmitRelease DDEX ERN"]
        HS9["normalizeRoyaltyStatement (Finance Forensics)"]
        HS10["executeDepartmentRecipe (indii Conductor)"]
        HS11["createProjectCanvasNoteBlock (Native NoteBlock)"]
    end

    subgraph Destinations ["3. Target Destinations & Views"]
        direction TB
        DEST_HQ["Executive Dashboard HQ"]
        DEST_SIDEBAR["Sidebar Rail 64px vs 240px"]
        DEST_AUTH["Local Biometric Auth Gate"]
        DEST_PALETTE["Command Palette Cmd+K Modal"]
        DEST_A2UI["A2A Agent Canvas Overlay"]
        DEST_BOARDROOM["Executive Boardroom View"]
        DEST_CHECKOUT["Stripe Founder Checkout Flow"]
        DEST_MODULE["Target Module Workspace"]
        DEST_QUICK_NOTES["Global Quick-Capture Drawer (⌘J)"]
        DEST_SETTINGS_MODAL["Settings Floating Overlay Modal (⌘,)"]
        DEST_PROJECT_CANVAS["Project Canvas Landing View"]
        DEST_FILE_EXPLORER["File Explorer View"]
        DEST_WORKFLOW_LAB["Workflow Lab (Swarm Intelligence)"]
        DEST_KB_MODULE["Knowledge Base (Swarm Intelligence)"]
        DEST_KB_DRAWER["RightPanel Knowledge Base Slide-Over"]

        DEST_SPEECH["Browser Speech Transcriber"]
        DEST_HALT["Inference Stream Halted"]
        DEST_RAG["RAG Grounding Prompt Context"]
        DEST_PICKER["OS File System Picker"]
        DEST_MINBAR["Minimized Floating Bar"]

        DEST_DRAWER["Right Context Inspector"]
        DEST_APPR_QUEUE["Human Spend Consent Queue"]
        DEST_ART_VIEW["Agent Markdown Documents"]
        DEST_MEDIA_LIB["Stems Artwork & Video Library"]
        DEST_GEN_TRAY["Slide-out Creations Tray"]
        DEST_ARCH_VIEW["Historical Chat Session Transcripts"]

        DEST_RESOLVER["Awaited Async Promise Resolved"]

        DEST_CANVAS["Creative Raster Canvas / Timeline"]
        DEST_DOWNLOAD["PNG WebP File Download"]
        DEST_PREFLIGHT_QC["Distribution Pre-Flight Audio & QC Tab"]
        DEST_DSP["DSP Transmission Queue SFTP"]
        DEST_STATEMENT_FORENSICS["Finance Royalty Statement Forensics Tab"]
        DEST_RECIPE_EXEC["Automated Recipe Execution Runner"]
        DEST_NOTEBLOCK["Native NoteBlock on Canvas"]
    end

    %% Global Shell Connections
    B1 --> H1 --> DEST_HQ
    B2 --> H2 --> DEST_SIDEBAR
    B3 --> H3 --> DEST_AUTH
    B4 --> H4 --> DEST_PALETTE
    B5 --> H5 --> DEST_A2UI
    B6 --> H6 --> DEST_BOARDROOM
    B7 --> H7 --> DEST_CHECKOUT
    B8 --> H8 --> DEST_MODULE
    B9 --> H9 --> DEST_QUICK_NOTES
    B10 --> H10 --> DEST_SETTINGS_MODAL
    B11 --> H11 --> DEST_PROJECT_CANVAS
    B12 --> H12 --> DEST_FILE_EXPLORER
    B13 --> H13 --> DEST_WORKFLOW_LAB
    B14 --> H14 --> DEST_KB_MODULE
    B15 --> H15 --> DEST_KB_DRAWER

    %% Command Bar Connections
    C1 --> HC1 --> DEST_SPEECH
    C2 --> HC2 --> DEST_HALT
    C3 --> HC3 --> DEST_RAG
    C4 --> HC4 --> DEST_PICKER
    C5 --> HC5 --> DEST_MINBAR

    %% Right Panel Connections
    P1 --> HP1 --> DEST_DRAWER
    P2 --> HP2 --> DEST_APPR_QUEUE
    P3 --> HP3 --> DEST_ART_VIEW
    P4 --> HP4 --> DEST_MEDIA_LIB
    P5 --> HP5 --> DEST_GEN_TRAY
    P6 --> HP6 --> DEST_ARCH_VIEW

    %% Dialog Connections
    D1 --> HD1 --> DEST_RESOLVER
    D2 --> HD2 --> DEST_RESOLVER
    D3 --> HD3 --> DEST_RESOLVER

    %% Department, Studio & Canvas Connections
    S1 --> HS1 --> DEST_HQ
    S2 --> HS2 --> DEST_CANVAS
    S3 --> HS3 --> DEST_CANVAS
    S4 --> HS4 --> DEST_CANVAS
    S5 --> HS5 --> DEST_DOWNLOAD
    S6 --> HS6 --> DEST_PREFLIGHT_QC
    S7 --> HS7 --> DEST_PREFLIGHT_QC
    S8 --> HS8 --> DEST_DSP
    S9 --> HS9 --> DEST_STATEMENT_FORENSICS
    S10 --> HS10 --> DEST_RECIPE_EXEC
    S11 --> HS11 --> DEST_NOTEBLOCK
```

## Step-by-Step Transition Breakdown

### Phase 1: Input Trigger & Event Capture
- **Global Shell**: Triggers direct window actions (`return-hq-btn`, `sidebar-toggle`, `sidebar-biometric-toggle`, `founders-checkout-button`) or module switches through `throttledSetModule(id)`.
- **Bottom Rail Dock**: Persistent dock houses the User Identity pill, live status indicator, Quick Notes trigger (`bottom-rail-notes-btn` / `Cmd+J`), and Settings gear trigger (`bottom-rail-settings-btn` / `Cmd+,`).
- **Project Selection & Dual Workspace**: Selecting a project from the `PROJECTS` dropdown lands directly on `Project Canvas` as the primary view, paired with the header workspace switcher: `[ Spatial Canvas | File Explorer ]`.
- **Swarm Intelligence & Automations Cluster**: Top-level sidebar items house Executive Boardroom, Agent Canvas, Workflow Builder, and Knowledge Base. Knowledge Base also features persistent slide-over drawer access across all departments.
- **Command Bar**: Captures speech input, manual text prompts, file attachments, and prompt context configuration (`knowledge-grounding-toggle`).
- **Right Omni-Panel**: Controls drawer expansion, contextual inspector tabs (`approvals`, `artifacts`, `assets`), Knowledge Base slide-over, and chat history archive navigation.
- **Standalone Dialogs**: Intercepts user confirmations, alerts, and inputs via deterministic `react-call` promise lifecycles.
- **Department & Studio Action Bars**:
  - Creative studio navigation, view mode history traversal (`viewModeBack` / `viewModeForward`), canvas generation modes, and exports.
  - Distribution Pre-Flight Audio & Acoustic QC tab (`import-track-preflight-input`, `save-preflight-analysis-button`) with waveform visualization, acoustic DSP, and LUFS compliance metering.
  - Finance Royalty Statement Forensics tab (`upload-royalty-statement-btn`) for auditing and normalizing distributor CSV statements.
  - Department 1-Click Recipe Execution Cards (`dept-recipe-card-run-btn`).
  - Native `NoteBlock` creation and spatial manipulation directly on Project Canvas.

### Phase 2: State Handlers & Store Mutations
- Events trigger Zustand state updates in dedicated domain slices (`appSlice.ts`, `creativeControlsSlice.ts`, `audioIntelligenceSlice.ts`, `financeSlice.ts`, `distributionSlice.ts`, `workflowSlice.ts`).
- `appSlice.setQuickNotesOpen(true)` and `appSlice.setSettingsOpen(true)` mount global overlay surfaces without interrupting the active module workspace.
- `setModule('files')` and `setModule('project-canvas')` switch between the File Explorer and Spatial Canvas while maintaining active project context.
- Asynchronous actions dispatch cancel signals via `AbortSignal` or trigger Web Speech API recognition instances.
- Debounce guards (150ms) prevent rapid module jumping crashes against Firestore real-time listeners.

### Phase 3: Terminal Destination & View Rendering
- **Workspace Navigation**: Transitions top-level route components or toggles modal dialog overlays (e.g., Settings floating modal, Quick-Capture drawer).
- **Project Canvas**: Renders spatial DOM blocks (`NoteBlock`, `AssetBlock`, `WorkflowBlock`) with hardware-accelerated transforms and non-executing visual lineage edges.
- **Omni-Drawer Panels**: Dynamically mounts sub-panels (`ToolApprovalsPanel`, `ArtifactsPanel`, `AssetsPanel`, `KnowledgeBaseDrawer`) with lazy-loaded Suspense boundaries.
- **Pre-Flight QC & Forensics**: Renders real-time waveform monitors and LUFS compliance gauges inside Distribution, or verified earnings statement audit tables inside Finance.
- **External Pipelines**: Queues validated ERN 4.3 DDEX packages for DSP delivery or triggers file asset downloads.
