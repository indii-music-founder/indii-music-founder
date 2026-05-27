# 📱 indii.music Architecture Blueprint

**Vision:** *A multi-million-dollar production studio in the palm of a solo artist's hand.*

## 🗺️ System Diagram

```mermaid
graph TD
    classDef client fill:#1E293B,stroke:#38BDF8,stroke-width:2px,color:#fff;
    classDef cloud fill:#0F172A,stroke:#64748B,stroke-width:2px,color:#fff;
    classDef storage fill:#334155,stroke:#10B981,stroke-width:2px,color:#fff;
    classDef api fill:#4C1D95,stroke:#A78BFA,stroke-width:2px,color:#fff;
    classDef output fill:#064E3B,stroke:#34D399,stroke-width:2px,color:#fff;

    subgraph Client ["📱 indii.music Thin Client (Artist UI)"]
        direction TB
        UI_UP["🎵 1. The Drop<br>(Upload Unmastered Audio)"]:::client
        UI_PROMPT["✍️ 2. The Vision<br>(Vibe Prompts & Annotations)"]:::client
        UI_FEED["🔔 3. The Release<br>(Live Progress & Playback)"]:::client
    end

    subgraph Backend ["☁️ indiiOS Kernel (Google Cloud Backend)"]
        direction TB
        GATEWAY{"API Gateway & Async Orchestrator<br>(Traffic Cop & Event Manager)"}:::cloud
        
        subgraph DataStore ["State & Asset Management"]
            DB[("Firestore<br>(Session State)")]:::storage
            GCS[("Cloud Storage<br>(Media Asset URIs)")]:::storage
        end
        
        GATEWAY <-->|Read/Write State| DB
        GATEWAY <-->|Manage Temp/Final URIs| GCS

        subgraph VertexAI ["🧠 Vertex AI: The 5-API Studio Engine"]
            direction TB
            NB2["1. NB2 (The Analyst)<br>BPM, Stem Mapping, Mood Semantics"]:::api
            NBPRO["2. NB PRO (Virtual Manager)<br>Autonomous Campaign Strategy"]:::api
            IMG["3. Imagen 4.0 (Art Dept)<br>Album Art & Iterative Pixel Edits"]:::api
            VEO["4. Veo 3.1 (Cinematographer)<br>High-Fidelity Gen Video & Physics"]:::api
            OMNI["5. Omni Flash (Master Editor)<br>Beat-Sync Compilation & GFX"]:::api
        end

        %% Execution Flow
        GATEWAY -->|Step 1 Sync: Raw Audio Payload| NB2
        NB2 -->|Return: BPM, Beat Map, Mood| GATEWAY
        
        GATEWAY -->|Step 2 Sync: NB2 Data + Vibe Prompt| NBPRO
        NBPRO -->|Return: Campaign Blueprint| GATEWAY
        
        GATEWAY -->|Step 3 Async: Prompts & Bitmasks| IMG
        IMG -->|Return: Edited Image URIs| GATEWAY
        
        GATEWAY -->|Step 4 Async: Scene Logic + Audio| VEO
        VEO -->|Return: Raw Video Clip URIs| GATEWAY
        
        GATEWAY -->|Step 5 Async: Multi-URI Manifest + Beat Map| OMNI
        OMNI -->|Return: Compiled Timeline URIs| GATEWAY
    end

    subgraph Outputs ["🚀 Final Distribution Vault"]
        direction LR
        ART["🖼️ Master Album Art"]:::output
        SOCIAL["📱 15s TikTok/Reels Teasers"]:::output
        MV["🎬 4K Master Music Video"]:::output
    end

    %% Client/Server Connections
    UI_UP -->|HTTPS Payload| GATEWAY
    UI_PROMPT -->|WebSocket / SSE Request| GATEWAY
    GATEWAY -.->|Stream Async Render Updates| UI_FEED
    
    %% Final Delivery
    GATEWAY ===>|Commit Final Assets| Outputs
```

## 📋 How to Use This Blueprint With Your Team

### 1. For Your UI/Frontend Team (The Top Section)
You can tell them to completely ignore how AI works. Their only job is to build a beautiful, fluid interface that sends an audio file, a text string, or coordinates from a screen tap to the Gateway. They just need to elegantly display notifications when the backend says *"I'm done."* This guarantees the app never crashes an artist's phone.

### 2. For Your Backend Team (The Middle Section)
This is their bible. It shows that the **API Gateway** acts as a strict "Traffic Cop." Notice how the Gateway passes Cloud Storage URIs (links) to the 5 APIs instead of the massive video files themselves. This ensures your compute costs stay incredibly efficient and your pipeline never bottlenecks.

### 3. The 5-API Waterfall
The chart clearly visualizes the necessity of all 5 endpoints:
* **NB2** listens and analyzes the track.
* **NB PRO** plans the strategy.
* **Imagen 4.0** and **Veo 3.1** shoot the raw materials (Art & Cinematography).
* **Omni Flash** handles the final beat-sync edit.

### 💡 A Few Bonus Tips for your Engineering Team
Since you are relying on Google Cloud for this perfectly decoupled architecture, here are a few specific tools your team should look at to implement this diagram perfectly:
* **The "Traffic Cop" Orchestrator:** Your backend team should look into **Google Cloud Workflows**. It is specifically designed for multi-step "waterfall" API calls and can natively handle the long wait times for asynchronous video generation (like Veo 3.1) without timing out or racking up compute costs while idling.
* **The Drop (Uploads):** Tell the frontend team to use **Signed URLs** for Google Cloud Storage. Instead of pushing an audio payload directly *through* the Gateway (which can hit size limits), have the Gateway give the mobile app a Signed URL to upload the raw audio directly to the GCS bucket.
* **The Release (Live Updates):** Because you are using **Firestore**, the mobile app can just use native Firestore Real-time Listeners (snapshot streams). Whenever the Gateway updates the session state in Firestore, the UI will automatically update loading bars on the artist's phone without your team needing to build and maintain complex custom WebSockets!
