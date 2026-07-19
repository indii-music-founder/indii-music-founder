# Remote Dispatch Macro Architecture

This document describes the high-level data flow and architecture of the indii Remote Dispatch system, designed as a "Zero-Local-Data" pocket assistant for artists on the road.

## Architecture Flowchart

```mermaid
flowchart TD
    %% Define styles
    classDef mobile fill:#000000,stroke:#2E2EFE,stroke-width:2px,color:#F0F0F0
    classDef cloud fill:#111111,stroke:#FE2E9A,stroke-width:2px,color:#F0F0F0,stroke-dasharray: 5 5
    classDef desktop fill:#1a1a1a,stroke:#2E2EFE,stroke-width:2px,color:#F0F0F0
    classDef external fill:#222,stroke:#555,stroke-width:1px,color:#ccc

    %% Nodes
    subgraph MobileApp ["Mobile Remote App (Pocket Assistant)"]
        UI_Home["Homepage (Quick Actions)"]
        UI_Chat["Agent Chat Interface"]
        UI_Stream["Secure Audio Player"]
        VoiceMic["Voice-First Mic"]
        
        UI_Home --> UI_Chat
        UI_Home --> VoiceMic
        UI_Home --> UI_Stream
    end

    subgraph FirebaseCloud ["Firebase Backend (The Vault)"]
        FS_Queue["Firestore:\nagent_dispatch_queue"]
        FS_CRM["Firestore:\ncrm_contacts"]
        F_Storage["Cloud Storage:\nSecure Audio Vault"]
        F_Auth["Firebase Auth"]
    end

    subgraph DesktopExecutor ["Desktop Application (The Engine)"]
        ElectronBG["Electron Background Process"]
        MCP_Server["Antigravity MCP Server"]
        Desktop_Sync["Firestore Sync Listener"]
        Tool_Exec["Local OS / DAW Tools"]
        
        ElectronBG --> Desktop_Sync
        Desktop_Sync --> MCP_Server
        MCP_Server --> Tool_Exec
    end

    %% Flow: Mobile -> Cloud
    VoiceMic -- "1. Dictates Audio Data" --> FS_Queue
    UI_Chat -- "1. Sends Command" --> FS_Queue
    
    %% Flow: Cloud -> Desktop
    FS_Queue -- "2. Syncs Task (Realtime)" --> Desktop_Sync
    Tool_Exec -- "3. Executes & Updates State" --> FS_Queue
    
    %% Flow: Desktop -> CRM
    Tool_Exec -- "4. Saves Structured Data" --> FS_CRM
    
    %% Flow: Cloud -> Mobile (Streaming)
    F_Storage -. "Streams (No Local Save)" .-> UI_Stream
    FS_CRM -. "Syncs Data" .-> UI_Home
    
    %% Apply styles
    class MobileApp,UI_Home,UI_Chat,UI_Stream,VoiceMic mobile
    class FirebaseCloud,FS_Queue,FS_CRM,F_Storage,F_Auth cloud
    class DesktopExecutor,ElectronBG,MCP_Server,Desktop_Sync,Tool_Exec desktop
```

## Transition Breakdown

1.  **Zero-Local-Data Mobile:** The phone app stores absolutely no business logic or unreleased tracks locally. If the phone is lost, no data is compromised.
2.  **Voice-First Input:** Users click the microphone, dictate notes or hand the phone to a contact, and the raw audio/text is sent to the `agent_dispatch_queue`.
3.  **Silent Desktop Executor:** The Electron app at home runs silently in the background, listening to the `agent_dispatch_queue`. It picks up the task, uses MCP tools to parse it, executes local OS tools if needed, and writes the structured output back to Firestore.
4.  **Secure Streaming:** The audio player streams works-in-progress directly from Firebase Storage, bypassing local downloads entirely.
