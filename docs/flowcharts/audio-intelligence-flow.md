# Music & Audio DNA Intelligence Flowchart

This flowchart maps the technical execution path for the audio intelligence suite in indii. It details how raw audio files are processed client-side for DNA extraction (BPM, Key, Mood), how that metadata interacts with the MusicAgent, and how Text-to-Speech (TTS) generation is offloaded to the backend.

```mermaid
graph TD
    %% UI Components
    subgraph UI ["Client UI (packages/renderer/src/modules/music/)"]
        Dropzone["Audio File Dropzone"]
        Visualizer["Waveform & DNA Dashboard"]
        TTSInput["Text-to-Speech Prompt Input"]
    end

    %% Client Services & Analysis
    subgraph ClientLogic ["Client Logic & Extraction"]
        AudioIntSlice["Zustand `audioIntelligenceSlice`"]
        Wavesurfer["Wavesurfer.js (Waveform Rendering)"]
        Essentia["Essentia.js (WASM Audio Analysis)"]
        MusicAgent["MusicAgent (A2A Specialist)"]
    end

    %% Backend Execution
    subgraph CloudFunctions ["Firebase Cloud Functions"]
        GenSpeechFn["`generateSpeech` (Callable HTTPS)"]
        AuthCheck["Quota Verification Gate"]
    end

    %% AI & Storage Infrastructure
    subgraph GCP ["Google Cloud Platform"]
        Storage["Firebase Cloud Storage (`gs://`)"]
        Firestore["Firestore Database (`tracks` metadata)"]
        VertexTTS["Vertex AI (`gemini-2.5-pro-tts-preview`)"]
    end

    %% Transitions - Audio DNA Extraction
    Dropzone -->|"User uploads .wav/.mp3"| Wavesurfer
    Wavesurfer -->|"Decodes & Renders"| Visualizer
    
    Dropzone -->|"Passes Audio Buffer"| Essentia
    Essentia -->|"Extracts BPM, Key, Energy (WASM)"| AudioIntSlice
    AudioIntSlice -->|"Updates DNA Dashboard"| Visualizer
    
    AudioIntSlice -->|"Passes metadata for analysis"| MusicAgent
    MusicAgent -->|"Generates marketing insights"| UI
    
    AudioIntSlice -->|"Saves DNA Profile"| Firestore
    Wavesurfer -->|"Uploads Original File"| Storage

    %% Transitions - Text-To-Speech
    TTSInput -->|"Submits Text & Voice Profile"| GenSpeechFn
    GenSpeechFn -->|"Verifies tier limits"| AuthCheck
    AuthCheck -->|"Pass"| VertexTTS
    
    VertexTTS -->|"Generates Audio Buffer"| GenSpeechFn
    GenSpeechFn -->|"Uploads output"| Storage
    Storage -->|"Returns URL"| GenSpeechFn
    GenSpeechFn -->|"Returns URL to UI"| AudioIntSlice
    AudioIntSlice -->|"Loads into player"| Wavesurfer

    %% Styling
    style Dropzone fill:#00D4FF,color:#000
    style Visualizer fill:#00D4FF,color:#000
    style TTSInput fill:#00D4FF,color:#000

    style AudioIntSlice fill:#8A2BE2,color:#FFF
    style Wavesurfer fill:#8A2BE2,color:#FFF
    style Essentia fill:#8A2BE2,color:#FFF
    style MusicAgent fill:#8A2BE2,color:#FFF

    style GenSpeechFn fill:#FF8C00,color:#000
    style AuthCheck fill:#FF00FF,color:#FFF

    style VertexTTS fill:#39FF14,color:#000
    style Storage fill:#39FF14,color:#000
    style Firestore fill:#39FF14,color:#000
```

## Transition Breakdown

1. **Audio Ingestion & Rendering:** The user uploads a `.wav` or `.mp3` file into the **Audio File Dropzone**. This file is immediately handed to **Wavesurfer.js**, which decodes the audio and renders a visual waveform in the **Visualizer** for immediate playback capability.
2. **Local DNA Extraction:** Simultaneously, the audio buffer is passed to **Essentia.js**, which runs heavy signal processing locally in the browser via WebAssembly (WASM). It extracts the structural DNA of the track (BPM, Key, Scale, Energy, Mood) without needing to upload the raw file to a heavy backend compute server.
3. **State Sync:** The extracted data updates the **Zustand `audioIntelligenceSlice`**, populating the **DNA Dashboard** instantly.
4. **Agentic Handoff:** The structural metadata (e.g., "120 BPM, C Minor, High Energy") is injected into the context of the **MusicAgent**. The agent uses this raw data to generate human-readable insights (e.g., "This track fits well into workout playlists or high-energy sync placements").
5. **Persistence:** The original audio file is uploaded to **Firebase Cloud Storage**, and its corresponding DNA metadata is saved to the **Firestore** `tracks` collection for future retrieval.
6. **Text-to-Speech Generation:** If the user wants to generate vocal assets, they use the **Text-to-Speech Prompt Input**. This sends a secure payload to the **`generateSpeech`** Cloud Function.
7. **Cloud TTS Execution:** The backend runs the **Quota Verification Gate**, ensuring the user hasn't exceeded their limits. It then requests the audio from **Vertex AI (`gemini-2.5-pro-tts-preview`)**.
8. **Fulfillment:** The backend saves the generated audio buffer to **Storage**, returning the URL to the **`audioIntelligenceSlice`**, which loads it directly into **Wavesurfer.js** for the user to hear.
