# Creative Studio & Image Pipeline Flowchart

This deep-dive flowchart maps the low-level technical execution of the indii Creative Studio. It traces the lifecycle of an image generation or manipulation request from the React UI components, through the Canvas engine (Fabric.js), down to the Firebase Cloud Functions backing Vertex AI for scalable image synthesis.

```mermaid
graph TD
    %% UI Components
    subgraph Frontend ["React UI Layer (packages/renderer/src/modules/creative/)"]
        Studio["Creative Studio Workspace"]
        CanvasUI["Canvas Overlay Controls"]
        PromptBox["Image Generation Prompt Input"]
        Showroom["Product Visualization Showroom"]
    end

    %% State Management
    subgraph State ["State Management"]
        CreativeSlice["Zustand `creativeSlice`"]
        FabricState["Fabric.js Object State"]
    end

    %% Client Services
    subgraph ClientServices ["Client Services"]
        ImageService["ImageGenerationService (Client)"]
        CanvasEngine["Canvas Interaction Engine (Fabric.js wrapper)"]
        AssetService["AssetStorageService"]
    end

    %% Backend Execution
    subgraph CloudFunctions ["Firebase Cloud Functions (Node.js 22)"]
        GenImageFn["`generateImage` (Callable HTTPS)"]
        AuthCheck["Quota & Tier Verification (Firestore)"]
    end

    %% AI & Storage Infrastructure
    subgraph GCP ["Google Cloud Platform"]
        VertexImage["Vertex AI (`gemini-3-pro-image-preview`)"]
        CloudStorage["Firebase Cloud Storage (`gs://`)"]
        Firestore["Firestore Database (`assets` collection)"]
    end

    %% Transitions
    Studio -->|"Renders"| CanvasUI
    Studio -->|"Renders"| PromptBox
    PromptBox -->|"Submits Text/Ref Image"| ImageService
    
    CanvasUI -->|"Draws/Transforms/Outpaints"| CanvasEngine
    CanvasEngine <-->|"Syncs Layer Data"| FabricState
    FabricState -->|"Updates Global Store"| CreativeSlice
    
    ImageService -->|"Dispatches HTTPS Call"| GenImageFn
    GenImageFn -->|"Validates Pro/Enterprise Status"| AuthCheck
    AuthCheck -->|"Pass (Rate limit check)"| VertexImage
    
    VertexImage -->|"Generates Raw Buffer"| GenImageFn
    GenImageFn -->|"Uploads Final Image"| CloudStorage
    CloudStorage -->|"Returns Signed URL / gs:// URI"| GenImageFn
    GenImageFn -->|"Saves Metadata"| Firestore
    
    GenImageFn -->|"Returns Payload"| ImageService
    ImageService -->|"Loads Image to Workspace"| AssetService
    AssetService -->|"Adds to Canvas"| CanvasEngine
    CanvasEngine -->|"Renders on"| Showroom

    %% Styling
    style Studio fill:#00D4FF,color:#000
    style CanvasUI fill:#00D4FF,color:#000
    style PromptBox fill:#00D4FF,color:#000
    style Showroom fill:#00D4FF,color:#000

    style CreativeSlice fill:#8A2BE2,color:#FFF
    style FabricState fill:#8A2BE2,color:#FFF
    style ImageService fill:#8A2BE2,color:#FFF
    style CanvasEngine fill:#8A2BE2,color:#FFF
    style AssetService fill:#8A2BE2,color:#FFF

    style GenImageFn fill:#FF8C00,color:#000
    style AuthCheck fill:#FF00FF,color:#FFF

    style VertexImage fill:#39FF14,color:#000
    style CloudStorage fill:#39FF14,color:#000
    style Firestore fill:#39FF14,color:#000
```

## Transition Breakdown

1. **User Interaction:** The user inputs a prompt or uploads a reference image in the **Image Generation Prompt Input**. Alternatively, they manipulate existing elements on the screen via the **Canvas Overlay Controls**.
2. **Canvas State Sync:** Any interaction with the visual canvas is handled by the **Canvas Interaction Engine** (a wrapper around `Fabric.js`), which syncs the exact layer, position, and filter data with the `FabricState`. This is persisted globally in the **Zustand `creativeSlice`** so it survives route changes.
3. **Trigger Generation:** When a new image is requested (e.g., text-to-image or outpainting), the **ImageGenerationService** on the client bundles the prompt, style preferences, and any base64 reference images, dispatching a secure HTTPS Callable request to the backend.
4. **Backend Security Gate:** The **`generateImage`** Cloud Function executes. Before reaching Vertex AI, it hits the **Quota & Tier Verification** logic, checking the user's Firestore document. If a Free tier user requests an 8K generation or exceeds their 50/day limit, the function rejects immediately (preventing the "Thundering Herd" API cost issue).
5. **AI Execution:** The verified payload is sent to **Vertex AI** using the `gemini-3-pro-image-preview` model. 
6. **Storage & Persistence:** Vertex AI returns the raw image buffer. The Cloud Function securely uploads this buffer to **Firebase Cloud Storage**, retrieves the URL, and writes a metadata record to the **Firestore** `assets` collection for historical tracking.
7. **Workspace Integration:** The Cloud Function returns the final asset data to the client's **ImageService**. The **AssetService** fetches the image and seamlessly injects it back into the **CanvasEngine**, updating the user's **Showroom** instantly without page reloads.
