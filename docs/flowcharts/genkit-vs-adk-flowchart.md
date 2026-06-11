# Genkit vs. ADK Architectural Flowchart

This document maps the hybrid orchestration architecture of **indii**, demonstrating why the local client-led design is mathematically and operationally superior to a dedicated cloud swarm platform (ADK) for independent music production software.

## System Flowchart

```mermaid
graph TD
    %% Styling
    classDef client fill:#1A1B26,stroke:#7AA2F7,stroke-width:2px,color:#C0CAF5;
    classDef server fill:#1F2937,stroke:#10B981,stroke-width:2px,color:#F3F4F6;
    classDef cloud fill:#111827,stroke:#EC4899,stroke-width:2px,color:#F9FAFB;
    classDef bad fill:#2A1A1A,stroke:#EF4444,stroke-width:2px,stroke-dasharray: 5 5,color:#FCA5A5;

    subgraph DesktopElectronClient["Desktop App (Electron Studio - Native Local Runtime)"]
        A["Local File System (Massive WAVs, Video Stems, Stems)"]
        B["Native TS Conductor (AgentGraphService)"]
        C["Local Native Tools (FFmpeg, Fabric.js, Canvas, IPC)"]
        
        A <--> B
        B <--> C
    end

    subgraph FirebaseCloud["Stateless Serverless Layer (GCP Cloud Functions)"]
        D["Firebase Gen 2 Cloud Functions"]
        E["Genkit AI SDK (v1.26 Pinned)"]
        F["GCP Vertex AI / Gemini 3 Pro & Flash"]
        
        D --- E
        E --- F
    end

    subgraph GCPManaged["Dedicated Cloud Swarm (GCP Agent Platform)"]
        G["GCP ADK (Agent Development Kit)"]
        H["Persistent Cloud Swarms / Managed VMs"]
        
        G --- H
    end

    %% Flow lines
    B -- "1. High-Performance Local Execution (Zero-Latency Audio/Video Editing)" --> C
    B -- "2. Secure, Stateless API Delegation (Opaque Handles, R2A2 Pre-scanned)" --> D
    
    %% Exclusions
    B -.-x| "REJECTED (Severe Latency, Costly Continuous VM Overhead)" | G

    %% Class Assigns
    class DesktopElectronClient,A,B,C client;
    class FirebaseCloud,D,E,F server;
    class GCPManaged,G,H bad;
```

## Flow Transitions

1. **Local File I/O:** The user loads high-definition master tracks or multi-track stems. The `AgentGraphService` (the Conductor) runs completely locally on the native desktop environment.
2. **Native Tool Delegation:** To perform intensive DSP operations (e.g., rendering video components with Remotion, dissecting audio transients with Essentia, or converting formats with FFmpeg), the Conductor initiates zero-latency shell processes natively.
3. **Stateless Model Actions:** For cognitive agent tasks, the Conductor generates request packages pre-scanned by the `InputSanitizer` (R2A2 security gate). It sends these stateless payloads to Firebase Gen 2 Cloud Functions, leveraging pinned `genkit` (1.26.0) wrappers.
4. **Cloud Swarm Exclusion (Why ADK is rejected):** Moving large audio stems to persistent GCP ADK swarms would require massive upload times, introduce substantial network overhead, and incur high, continuous cloud VM billing rates, which breaks the business model for independent music creators.
