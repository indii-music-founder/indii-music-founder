# IA Consolidation Architecture (Macro)

```mermaid
flowchart TD
    %% Base entry points
    Start([User opens Creative Studio])
    
    %% Option A: Krea-style
    subgraph OptionA["Option A: Unified Canvas (Krea-style)"]
        CanvasA[Single Canvas Workspace]
        ModelPicker[Global Model Picker<br>Flux/Imagen/Kling]
        CanvasA --- ModelPicker
        CanvasA --- ChatA[Demoted Chat<br>Drawer/Floating]
    end
    
    %% Option B: Photoshop-style
    subgraph OptionB["Option B: Contextual Layering (PS-style)"]
        CanvasB[Canvas Workspace]
        ContextBar[Contextual Task Bar<br>Appears on selection]
        Layers[History/Versions<br>as nondestructive layers]
        CanvasB --- ContextBar
        CanvasB --- Layers
    end

    %% Option C: Minimal
    subgraph OptionC["Option C: Minimal Fixes"]
        Tabs[Retain 6 Tabs<br>GENERATE/VIDEO/OMNI/etc]
        OverlapFix[Fix UI Overlap Only]
        Tabs --- OverlapFix
    end

    Start --> OptionA
    Start --> OptionB
    Start --> OptionC

    classDef recommended fill:#003366,stroke:#3399ff,color:#fff
    class OptionA recommended
```

**Transition Breakdown:**
- **Start -> Options:** Represents the architectural split. Only one path will be chosen for implementation.
- **Option A Flow:** Centralizes the experience on the canvas, removing the 6 top tabs and replacing them with a mode/model dropdown.
- **Option B Flow:** Focuses on layer-based history and contextual UI that appears upon selection, merging the disjointed history panels.
- **Option C Flow:** Smallest code footprint, keeping the current tab structure but fixing the CSS overlap bugs and preventing multiple floating panels.
