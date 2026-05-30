# Creative Suite Hybrid Execution Flowchart

This flowchart maps the Hybrid Architecture model where the **Human User** and the **AI Swarm** act as peer "drivers" that both utilize the unified **Creative Suite Engine** (the 5-API Waterfall) to generate and edit media assets.

```mermaid
graph TD
    %% Define Styles
    classDef ui fill:#00D4FF,stroke:#00acc1,stroke-width:2px,color:#000
    classDef swarm fill:#8A2BE2,stroke:#4a148c,stroke-width:2px,color:#fff
    classDef gateway fill:#39FF14,stroke:#1b5e20,stroke-width:2px,color:#000
    classDef ai fill:#FF8C00,stroke:#e65100,stroke-width:2px,color:#fff
    classDef storage fill:#FF00FF,stroke:#880e4f,stroke-width:2px,color:#fff

    %% Subgraphs for boundary clarity
    subgraph Drivers ["Execution Drivers (Clients)"]
        direction LR
        Human["Human User (React UI)"]:::ui
        Conductor["Agent Swarm (AgentGraphService)"]:::swarm
    end

    subgraph CreativeSuite ["Creative Suite Engine (5-API Waterfall)"]
        direction TB
        Gateway["API Gateway / Tool Proxy"]:::gateway
        
        NB2["NB2 (Audio Processing)"]:::ai
        NBPro["NB PRO (Strategy & Direction)"]:::ai
        Imagen["Imagen 4.0 (Art Dept)"]:::ai
        Veo["Veo 3.1 (Cinematographer)"]:::ai
        Omni["Omni Flash (Master Editor)"]:::ai
        
        Gateway -->|Audio Payloads| NB2
        Gateway -->|Logic/Strategy| NBPro
        Gateway -->|Image Payloads| Imagen
        Gateway -->|Video Payloads| Veo
        Gateway -->|Timeline/Sync| Omni
    end

    subgraph Infrastructure ["Data Layer"]
        GCS["Firebase Cloud Storage (gs:// URIs)"]:::storage
        Firestore["Firestore (Job Tracking)"]:::storage
    end

    %% Interactions
    Human -->|"Uploads Raw Media & Invokes UI Tools"| GCS
    Conductor -->|"Generates Media & Invokes Agent Tools"| GCS
    
    Human -->|"Passes gs:// Signed URIs"| Gateway
    Conductor -->|"Passes gs:// Signed URIs"| Gateway

    NB2 -.->|"Saves Output"| GCS
    NBPro -.->|"Saves Output"| GCS
    Imagen -.->|"Saves Output"| GCS
    Veo -.->|"Saves Output"| GCS
    Omni -.->|"Saves Output"| GCS

    Gateway -.->|"Updates Status"| Firestore
    Firestore -.->|"Real-time Listeners"| Human
    Firestore -.->|"State Checks"| Conductor
```

## Transition Breakdown

1. **Payload Upload (The Thin Client Protocol):**
   - Whether triggered by the human user clicking a button in the React UI, or an Agent Swarm tool autonomously deciding to create an asset, the raw binary file is **first** uploaded directly to Firebase Cloud Storage. 
   - No Base64 strings are ever passed in memory.
2. **Execution Trigger:**
   - The driver (Human or Swarm) calls the API Gateway, passing only the lightweight `gs://` Signed URIs. This completely decouples the heavy rendering process from the client devices.
3. **The 5-API Waterfall (Creative Suite):**
   - The Gateway acts as the "Traffic Cop", routing the request to the correct Vertex AI endpoint (Imagen 4.0 for images, Veo 3.1 for video, NB2 for audio analysis).
4. **Asynchronous Completion:**
   - The AI models run asynchronously. Upon completion, the backend uploads the final generated asset directly back to Cloud Storage.
   - The Gateway updates the Firestore job ticket to `completed`.
5. **State Sync:**
   - The Human UI receives a real-time snapshot update via Firestore listeners to display the new asset.
   - The Agent Swarm polls the job status or receives the URI callback, allowing it to continue its reasoning loop with the newly created asset.
