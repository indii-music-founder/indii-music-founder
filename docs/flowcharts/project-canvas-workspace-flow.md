# Project Canvas & Dual-Mode Workspace Architecture Flowchart

This flowchart documents the architecture and lifecycle of the **Project Canvas** within indii. Following the navigation realignment, Project Canvas is elevated to the primary landing view when selecting any project from the `PROJECTS` list. It models the dual-mode workspace switcher (`[ Spatial Canvas | File Explorer ]`), native block types (`NoteBlock`, `WorkflowBlock`, `AssetBlock`), SVG semantic edge rendering, spatial viewport virtualization, and defensive persistence.

```mermaid
graph TD
    %% Navigation & Entry Trigger
    subgraph Navigation ["Global Navigation & Project Selection"]
        SidebarProj["Sidebar Projects List (ProjectList.tsx)"]
        SelectProj["User clicks Project: syncProject(id) + setModule('project-canvas')"]
    end

    %% Workspace Shell & Dual Switcher
    subgraph WorkspaceShell ["Project Workspace Shell"]
        HeaderSwitcher["Dual-Mode Workspace Switcher<br/>[ Spatial Canvas | File Explorer ]"]
        SpatialMode["Spatial Canvas (Active View)"]
        ExplorerMode["File Explorer View (setModule('files'))"]
    end

    %% Project Canvas Interactive Surface
    subgraph CanvasSurface ["Project Canvas Surface (ProjectCanvas.tsx)"]
        DOMRenderer["Hardware-Accelerated Spatial DOM Renderer<br/>(translate3d + scale)"]
        CanvasHUD["Canvas HUD (Pan, Zoom, Culling Status)"]
        CanvasToolbar["Canvas Toolbar (Tool Selection, Add Entity)"]
        EdgeLayer["SVG Semantic Lineage Layer (CanvasEdgeLayer.tsx)"]
        PresenceLayer["Multiplayer Presence Layer (useCanvasPresence)"]
    end

    %% Native Blocks
    subgraph NativeBlocks ["Spatial Canvas Blocks"]
        NoteBlock["Native NoteBlock<br/>(Rich Markdown Quick-Capture)"]
        WorkflowBlock["Native WorkflowBlock<br/>(1-Click Recipe Execution & Status)"]
        AssetBlock["AssetBlock<br/>(Audio, Stems, Video, Cover Art)"]
        AgentOutputBlock["AgentOutputBlock<br/>(Swarm Deliverables)"]
        ClusterBlock["ClusterBlock & LOD Downsampling"]
    end

    %% Engine & Virtualization
    subgraph Engine ["Viewport Virtualization & State"]
        Virtualization["useCanvasVirtualization<br/>(Spatial Culling Margin: 400px)"]
        StoreHooks["useProjectCanvas Store Hook"]
        UndoRedo["Undo / Redo History Stack"]
    end

    %% Persistence Layer
    subgraph Persistence ["Persistence & Conflict Resolution"]
        SaveProtection["Defensive Save-Race Protection<br/>(isDirty, isSaving debounce)"]
        FirestoreCanvas["Firestore `projectCanvases/{projectId}`"]
    end

    %% Flow Connections
    SidebarProj --> SelectProj
    SelectProj --> SpatialMode
    
    SpatialMode --> HeaderSwitcher
    HeaderSwitcher -->|"Click File Explorer"| ExplorerMode
    HeaderSwitcher -->|"Click Spatial Canvas"| DOMRenderer
    ExplorerMode -->|"Click Spatial Canvas: setModule('project-canvas')"| SpatialMode

    DOMRenderer --> CanvasToolbar
    DOMRenderer --> CanvasHUD
    DOMRenderer --> EdgeLayer
    DOMRenderer --> PresenceLayer

    CanvasToolbar -->|"Add Note"| NoteBlock
    CanvasToolbar -->|"Embed Recipe"| WorkflowBlock
    CanvasToolbar -->|"Ingest Media"| AssetBlock

    DOMRenderer --> Virtualization
    Virtualization --> ClusterBlock
    Virtualization --> NoteBlock
    Virtualization --> WorkflowBlock
    Virtualization --> AssetBlock
    Virtualization --> AgentOutputBlock

    NoteBlock --> EdgeLayer
    WorkflowBlock --> EdgeLayer
    AssetBlock --> EdgeLayer

    NoteBlock --> StoreHooks
    WorkflowBlock --> StoreHooks
    AssetBlock --> StoreHooks

    StoreHooks --> UndoRedo
    StoreHooks --> SaveProtection
    SaveProtection --> FirestoreCanvas

    %% Styling
    style SidebarProj fill:#00D4FF,color:#000
    style SelectProj fill:#00D4FF,color:#000
    style HeaderSwitcher fill:#00D4FF,color:#000
    style SpatialMode fill:#00D4FF,color:#000
    style ExplorerMode fill:#00D4FF,color:#000

    style DOMRenderer fill:#8A2BE2,color:#FFF
    style CanvasHUD fill:#8A2BE2,color:#FFF
    style CanvasToolbar fill:#8A2BE2,color:#FFF
    style EdgeLayer fill:#8A2BE2,color:#FFF
    style PresenceLayer fill:#8A2BE2,color:#FFF

    style NoteBlock fill:#FF00FF,color:#FFF
    style WorkflowBlock fill:#FF00FF,color:#FFF
    style AssetBlock fill:#FF00FF,color:#FFF
    style AgentOutputBlock fill:#FF00FF,color:#FFF
    style ClusterBlock fill:#FF00FF,color:#FFF

    style Virtualization fill:#FF8C00,color:#000
    style StoreHooks fill:#FF8C00,color:#000
    style UndoRedo fill:#FF8C00,color:#000

    style SaveProtection fill:#39FF14,color:#000
    style FirestoreCanvas fill:#39FF14,color:#000
```

## Step-by-Step Transition Breakdown

1. **Primary Project Selection & Landing:** When a user selects any project in `Sidebar.tsx` (`ProjectList.tsx`), the client executes `syncProject(project.id)` to load project metadata and immediately dispatches `setModule('project-canvas')`. Unlike legacy routing, the spatial **Project Canvas** is the primary, zero-latency landing view for active projects.
2. **Dual-Mode Workspace Switcher:** The top-left header of the canvas anchors a persistent workspace switcher: `[ Spatial Canvas | File Explorer ]`. Clicking "File Explorer" transitions the view seamlessly to `setModule('files')` for traditional directory browsing, while clicking "Spatial Canvas" returns directly to the infinite visual board with zoom and pan positions preserved.
3. **Hardware-Accelerated Spatial Rendering:** The canvas utilizes a hardware-accelerated DOM coordinate surface (`translate3d` + CSS `transform: scale`) rather than an opaque canvas bitmap, allowing full DOM interactivity, native text selection, and accessible rich-text controls.
4. **Native Spatial Blocks:**
   - **`NoteBlock`:** Direct on-canvas note capture and markdown documentation, completely replacing the retired Tools-menu Notes interface. Notes can be placed anywhere on the infinite plane and visually connected to assets.
   - **`WorkflowBlock` & `WorkflowRunBlock`:** Live automation blocks referencing recipes created in the elevated Swarm Intelligence Workflow Builder, allowing users to trigger runs and observe step progress directly in context.
   - **`AssetBlock` & `AgentOutputBlock`:** Master WAV stems, artwork drafts, and deliverables produced by specialist agents (e.g. Legal contracts, Marketing plans) with thumbnail previews and playback controls.
5. **Semantic Edge Connections:** An SVG layer (`CanvasEdgeLayer.tsx`) renders non-executing directional lineage curves between blocks, mapping artistic relationships (e.g., Audio Stem → Pre-Flight QC Note → Cover Art Draft) without cluttering block DOM hierarchies.
6. **Viewport Virtualization & LOD:** The `useCanvasVirtualization` engine computes block bounding boxes against the container viewport plus a 400px culling margin. Blocks outside the viewport are culled from the DOM; at extreme zoom-out levels, clusters collapse into lightweight `ClusterBlock` badges to sustain 60fps performance across thousands of project artifacts.
7. **Defensive Persistence & Anti-Race Guards:** All block movements, additions, and edits pass through `useProjectCanvas` into `ProjectCanvasPersistence.ts`. A debounced defensive save pipeline ensures that concurrent edits, rapid drag events, and network jitter never cause save-race overwrites or cross-project data leakage.
