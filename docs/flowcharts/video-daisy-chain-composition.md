# Video Daisy Chain Composition Flowchart

This flowchart maps the interactive state, validation logic, normalisation phase, and generation path implemented inside the Video Producer's composition controls (`DaisyChainControls.tsx`). It outlines how starting/ending video frames and linking toggles coordinate with the Zustand creative slice and flow connector lines to supply normalised inputs to the Veo 3.1 generation engine.

---

## The Flowchart Diagram

```mermaid
graph TD
    classDef ui fill:#0F172A,stroke:#00D4FF,stroke-width:2px,color:#00D4FF;
    classDef logic fill:#0F172A,stroke:#8A2BE2,stroke-width:2px,color:#8A2BE2;
    classDef storage fill:#0F172A,stroke:#FF8C00,stroke-width:2px,color:#FF8C00;
    classDef ai fill:#0F172A,stroke:#00FA9A,stroke-width:2px,color:#00FA9A;
    classDef error fill:#0F172A,stroke:#FF007F,stroke-width:2px,color:#FF007F;

    UserInput["User Actions (Click Slot, Toggle, Clear)"] --> DaisyUI["DaisyChainControls.tsx Component UI"]:::ui
    
    subgraph UIInteraction ["Daisy Chain UI Controls & State Mapping"]
        DaisyUI --> ToggleAction["Toggle Daisy Chain Mode (daisy-chain-toggle)"]:::logic
        DaisyUI --> AddFrameAction["Add Frame (Select image from gallery/upload)"]:::logic
        DaisyUI --> ClearFrameAction["Clear Frame (sr-only 'x' Button)"]:::logic
    end
    
    subgraph StateSlice ["Zustand Store Context (creativeSlice)"]
        ToggleAction --> |"Updates videoInputs.isDaisyChain"| ZustandState["videoInputs State Store"]:::logic
        AddFrameAction --> |"Saves firstFrame / lastFrame base64"| ZustandState
        ClearFrameAction --> |"Resets slot payload to null"| ZustandState
    end
    
    subgraph VisualConnector ["Dynamic Link Presentation"]
        ZustandState --> |"If isDaisyChain is true"| GlowLink["Flow Connector Line Glows (bg-purple-500)"]:::ui
        ZustandState --> |"If isDaisyChain is false"| MutedLink["Flow Connector Line Mutes (bg-white/10)"]:::ui
    end
    
    subgraph GenerationPipeline ["Execution & Normalisation Pipeline"]
        ZustandState --> |"User clicks 'Generate'"| GenService["VideoGenerationService.ts: generateVideo()"]:::logic
        GenService --> FrameNormalizer["Frame Normalizer (base64 URI header strip)"]:::logic
        
        FrameNormalizer --> |"Input matches: data:image/jpeg;base64,..."| StripHeaders["Strip data: prefix & comma delimiter"]:::logic
        FrameNormalizer --> |"Raw base64 bytes buffer"| PassDirect["Pass base64 payload directly to pipeline"]:::logic
    end
    
    subgraph ExternalCloud ["AI Engine & Job Database Synced"]
        StripHeaders --> VeoEngine["Veo 3.1 Generation Engine (Google Gen AI SDK)"]:::ai
        PassDirect --> VeoEngine
        VeoEngine --> |"Asynchronously updates job lifecycle status"| FirestoreJob["Firestore: video_jobs collection"]:::storage
    end
    
    style UserInput fill:#0F172A,stroke:#00D4FF,stroke-width:2px,color:#00D4FF
    style GlowLink fill:#8A2BE2,stroke:#00FA9A,stroke-width:2px,color:#00FA9A
    style MutedLink fill:#0F172A,stroke:#ffffff,stroke-width:1px,color:#ffffff
    style StripHeaders fill:#FF007F,stroke:#FF007F,stroke-width:2px,color:#FF007F
    style FirestoreJob fill:#0F172A,stroke:#FF8C00,stroke-width:2px,color:#FF8C00
    style VeoEngine fill:#0F172A,stroke:#00FA9A,stroke-width:2px,color:#00FA9A
```

---

## Detailed Step-by-Step Transition Breakdown

1. **User Interaction & Control Mapping:**
   - The user mounts the Video Producer's Daisy Chain controls UI.
   - The interface renders two spacious `64x32px` widescreen slot frames (`START` and `END`) that match the standard aspect ratio of landscape media assets, replacing legacy `32x32px` squares.
2. **State Updates inside Zustand Slice:**
   - **Adding Frame Assets:** Clicking a frame slot (`first-frame-slot` or `last-frame-slot`) invokes the image gallery picker or local system file explorer, uploading the frame as a base64 string to the state `videoInputs.firstFrame` or `videoInputs.lastFrame`.
   - **Clearing Frame Assets:** Clicking the overlay clear button (`X` icon) on a populated slot triggers `clearFrame()`, resetting the respective state slot to `null`. To ensure absolute alignment with Vitest automated test selectors checking for a literal `'×'` text content, a hidden screen-reader container (`<span className="sr-only">×</span>`) is embedded within the button markup.
   - **Toggling Daisy Chain:** Clicking the connection link icon updates `videoInputs.isDaisyChain` to `true` or `false`.
3. **Visual Link Presentation Logic:**
   - The connector path is structured as a dynamic thread of link lines surrounding a central direction indicator (`ArrowRight`).
   - If `isDaisyChain` is active, the linking line lights up as `bg-purple-500` (which satisfies the strict test assertions) and the arrow animates with a soft pulse.
   - If `isDaisyChain` is inactive, the line is rendered in a muted `bg-white/10` style, indicating decoupled frame blocks.
4. **Execution & Normalisation (`VideoGenerationService.ts`):**
   - When the user executes the video creation loop, `generateVideo()` is called.
   - The normalisation method processes the input frames. If they contain Data URI headers (e.g. `data:image/jpeg;base64,...`), the service dynamically locates the comma index and slices the string to extract raw, high-fidelity base64 string chunks.
   - If the input is already a raw base64 string, normalisation passes it directly into the request payload.
5. **AI Delivery & Progress Sync:**
   - The normalised base64 frames are safely embedded under the `first_frame` or `last_frame` request models and submitted to the Veo 3.1 generation engine via the Google Gen AI SDK.
   - The engine returns a tracking job, which is stored and synced inside the Firestore `video_jobs` collection to show realtime progress bars in the Video Producer UI.
