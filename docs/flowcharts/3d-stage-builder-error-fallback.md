# 3D Stage Builder Error Fallback Flowchart

This flowchart outlines the robust loading sequence and error boundary fallback system implemented inside the Creative Director's 3D Stage Builder canvas. It maps how asset loading (GLTF models) and environment mapping (remote HDR texture fetches) are securely isolated to prevent network blockages or file corruptions from crashing the entire user interface.

---

## The Flowchart Diagram

```mermaid
graph TD
    UserUI["User enters Creative Director UI"] --> CanvasMount["React Three Fiber Canvas mounts"]
    
    subgraph SceneSetup ["Scene Lighting & Floor Setup (Offline-Safe)"]
        CanvasMount --> InitLights["Initialize Local Stage Lights (Ambient, Spot, Directional)"]
        CanvasMount --> InitFloor["Initialize Stage Floor Mesh & GridHelper"]
    end
    
    subgraph AssetRendering ["Asset Load Path"]
        CanvasMount --> LoopAssets["Loop through Dropped GLTF/GLB Assets"]
        LoopAssets --> ModelBoundary["ModelErrorBoundary Gate"]
        ModelBoundary --> useGLTF["useGLTF(url) Hook"]
        useGLTF -->|Success| RenderModel["Render model on stage floor"]
        useGLTF -->|Fetch Failure| CatchModelError["ModelErrorBoundary Catches Error"]
        CatchModelError --> HideModel["Silently ignore failed asset & log warning"]
    end
    
    subgraph EnvLoading ["Environment Reflection Map Load Path"]
        CanvasMount --> EnvBoundary["EnvironmentErrorBoundary Gate"]
        EnvBoundary --> LoadHDR["Load preset='night' HDR texture from remote CDN"]
        
        LoadHDR -->|Network Online / Success| ApplyHDR["Apply high-fidelity environment reflection & fill map"]
        
        LoadHDR -->|Offline / DNS Block / CDN Down| FetchError["Could not load HDR: Failed to fetch"]
        
        FetchError -->|BEFORE FIX| BubbleCrash["Error bubbles up uncaught outside canvas"]
        BubbleCrash --> AppCrash["Studio Error Screen Overlay: 'Studio encountered an error'"]
        
        FetchError -->|AFTER FIX| EnvCatch["EnvironmentErrorBoundary Catches Error"]
        EnvCatch --> LogWarning["Log warning in console"]
        EnvCatch --> NullFallback["Return null (Render no environment map)"]
        NullFallback --> LightsFallback["Rely fully on pre-configured Local Stage Lights"]
    end
    
    RenderModel --> StageActive["Canvas remains 100% active, interactive, and beautifully lit"]
    ApplyHDR --> StageActive
    LightsFallback --> StageActive
    HideModel --> StageActive
    
    style UserUI fill:#00D4FF,stroke:#00acc1,stroke-width:2px
    style CanvasMount fill:#8A2BE2,stroke:#5c1fa6,stroke-width:2px
    style InitLights fill:#efebe9,stroke:#6d4c41,stroke-width:2px
    style InitFloor fill:#efebe9,stroke:#6d4c41,stroke-width:2px
    
    style useGLTF fill:#efebe9,stroke:#6d4c41,stroke-width:2px
    style CatchModelError fill:#FF00FF,stroke:#c2185b,stroke-width:2px
    
    style LoadHDR fill:#39FF14,stroke:#2e7d32,stroke-width:2px
    style ApplyHDR fill:#39FF14,stroke:#2e7d32,stroke-width:2px
    
    style AppCrash fill:#FF00FF,stroke:#d32f2f,stroke-width:3px
    style EnvCatch fill:#8A2BE2,stroke:#5c1fa6,stroke-width:2px
    style LightsFallback fill:#efebe9,stroke:#6d4c41,stroke-width:2px
    
    style StageActive fill:#39FF14,stroke:#2e7d32,stroke-width:3px
```

---

## Detailed Step-by-Step Transition Breakdown

1. **User Activation:** The user accesses the `Creative Director` UI module, triggers the `3D Stage Builder` view, mounting the React component.
2. **Offline-Safe Canvas Mounting:**
   - The `@react-three/fiber` `<Canvas>` is initialized.
   - The `Stage Floor Mesh` and the `GridHelper` reference are drawn instantly.
   - **Local Stage Lighting** is activated: an `ambientLight` (intensity 0.2), a `spotLight` (intensity 2.0), and two `directionalLight` arrays (intensity 0.5) provide offline-safe, high-quality, baseline illumination for the stage set.
3. **Dropped Asset Pipeline:**
   - Any dropped `.glb` or `.gltf` 3D files are processed inside `SceneBuilder.tsx`.
   - Each model is isolated under a React `ModelErrorBoundary` container.
   - If the `useGLTF` loading hook encounters a file parsing error or load issue, `ModelErrorBoundary` catches it immediately, silently preventing a canvas crash, and logs the warning.
4. **Environment Mapping Pipeline:**
   - The `<Environment preset="night" />` component is loaded inside the Canvas tree.
   - The loader attempts to fetch the HDR map `dikhololo_night_1k.hdr` from the default `drei-assets` remote CDN.
5. **The Error & Fallback Resolution:**
   - **Before the Fix:** If the CDN request failed (due to network disconnection, restricted corporate firewalls, or offline developer testing), the fetch error went uncaught within the canvas reconciler. It bubbled all the way to the top-level app `ErrorBoundary`, crashing the entire screen and showing the "Something went wrong. Studio encountered an error" overlay.
   - **After the Fix:** `<Environment>` is wrapped inside the `EnvironmentErrorBoundary` component. A network failure will throw a caught warning instead of a crash. The boundary catches the rejection, logs a warning message, and renders `null` to bypass remote reflections.
6. **Graceful Degrade Victory:** The stage builder remains 100% active, interactive, and well-lit by the primary local stage lights, providing a premium, offline-resilient user experience.
