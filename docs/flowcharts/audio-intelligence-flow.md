# Music & Audio DNA Intelligence Flowchart

This flowchart maps the technical execution path for the hybrid, local-first audio intelligence suite in indii. It details how raw audio files are processed natively under the Premium Electron desktop tier (using local Python extraction and ONNX/YAMNet classification) versus the standard Web browser fallback tier.

```mermaid
graph TD
    %% UI Components
    subgraph UI ["Client UI (packages/renderer/src/modules/tools/)"]
        Dropzone["Audio File Dropzone"]
        Visualizer["Waveform & DNA Dashboard"]
    end

    %% Client Services & Analysis
    subgraph ClientLogic ["Client Logic & Extraction"]
        AudioIntSlice["Zustand `audioIntelligenceSlice`"]
        Wavesurfer["Wavesurfer.js (Waveform Rendering)"]
        AudioAnalysisService["AudioAnalysisService"]
        AudioIntelligenceService["AudioIntelligenceService"]
    end

    %% Electron Main Process (Premium Tier)
    subgraph ElectronMain ["Electron Main Process (Premium Tier)"]
        IPCAnalyze["IPC Handler 'audio:analyze'"]
        SafeFile["safe-file:// Protocol Handler"]
        PythonAnalysis["Python audio_analysis.py (Acoustic + YAMNet ONNX)"]
        AccessControl["AccessControlService"]
    end

    %% Cloud AI Services
    subgraph CloudServices ["Cloud Services"]
        GeminiOnline["Gemini 3 Pro (Text-Only Semantic Synthesis)"]
        GeminiBase64["Gemini 3 Pro (Base64 Audio Upload - Browser Fallback)"]
    end

    %% Transitions - Ingestion
    Dropzone -->|"User loads audio"| EnvCheck{Running in Electron?}
    
    %% Electron Path
    EnvCheck -->|"Yes (Electron)"| SelectFile["window.electronAPI.selectFile()"]
    SelectFile -->|"Authorizes Path"| AccessControl
    SelectFile -->|"Set safe-file:// url"| SafeFile
    SafeFile -->|"Verify Access"| AccessControl
    SafeFile -->|"Stream from disk (Range Requests)"| Wavesurfer
    
    SelectFile -->|"filePath"| AudioAnalysisService
    AudioAnalysisService -->|"IPC audio:analyze"| IPCAnalyze
    IPCAnalyze -->|"Execute"| PythonAnalysis
    PythonAnalysis -->|"Acoustic Features + ONNX Tags"| IPCAnalyze
    IPCAnalyze -->|"Return Result"| AudioAnalysisService
    
    AudioAnalysisService -->|"technical features"| AudioIntelligenceService
    AudioIntelligenceService -->|"Check internet"| NetCheck{Is Online?}
    NetCheck -->|"Yes"| GeminiOnline
    NetCheck -->|"No"| OfflineFallback["degradeToLocalSemantic (Local ONNX mappings)"]

    %% Browser Path
    EnvCheck -->|"No (Browser)"| BrowserRead["FileReader (arrayBuffer)"]
    BrowserRead -->|"Decode (Web Audio API)"| Wavesurfer
    BrowserRead -->|"decodeAudioData"| AudioAnalysisService
    AudioAnalysisService -->|"Basic BPM/Key WASM Fallback"| AudioIntelligenceService
    AudioIntelligenceService -->|"Base64 Audio Upload"| GeminiBase64

    %% Common output
    GeminiOnline -->|"DNA Profile + Copy"| AudioIntSlice
    GeminiBase64 -->|"DNA Profile + Copy"| AudioIntSlice
    OfflineFallback -->|"DNA Profile (Local only)"| AudioIntSlice
    AudioIntSlice -->|"Update UI"| Visualizer

    %% Styling
    style Dropzone fill:#00D4FF,color:#000
    style Visualizer fill:#00D4FF,color:#000
    style AudioIntSlice fill:#8A2BE2,color:#FFF
    style Wavesurfer fill:#8A2BE2,color:#FFF
    style AudioAnalysisService fill:#8A2BE2,color:#FFF
    style AudioIntelligenceService fill:#8A2BE2,color:#FFF
    style ElectronMain fill:#FF8C00,color:#FFF
    style PythonAnalysis fill:#FF00FF,color:#FFF
    style GeminiOnline fill:#39FF14,color:#000
    style GeminiBase64 fill:#39FF14,color:#000
```

## Transition Breakdown

1. **Environment Detection:** When a user loads a track, the application checks if it is running inside the **Electron Desktop environment** (Premium tier) or a **standard Web browser** (Lite tier).
2. **Premium Electron Native Pipeline:**
    - **Native Dialog:** The app calls `window.electronAPI.selectFile()`, spawning the OS file dialog in the Main process. The path is authorized via **AccessControlService**.
    - **Secure Streaming Preview:** The waveform viewer loads `safe-file://${filePath}`. The custom protocol handler streams chunks of the lossless audio directly from disk, avoiding memory spikes in the Chromium renderer.
    - **Local Acoustic & ONNX Classification:** The file path is passed to the native `audio:analyze` IPC handler, which executes the background Python worker script (`audio_analysis.py`). This script extracts technical markers (BPM, key, scale, energy) and performs YAMNet ONNX audio classification locally on the user's CPU/GPU.
    - **Hybrid Online Synthesis:** If online, the local metrics and confidence scores are sent to **Gemini 3 Pro** via a cheap, text-only prompt to synthesize editorial pitch copy and target generation prompts, saving latency and network costs.
    - **Offline Graceful Degradation:** If offline, the app maps the local ONNX classification scores directly to the DDEX database schema using `degradeToLocalSemantic()`, keeping the entire pipeline fully operational.
3. **Web Browser Fallback Pipeline:**
    - The browser decodes the audio file to an AudioBuffer via the standard Web Audio API.
    - **Basic Analysis Fallback:** It runs lightweight mathematical heuristics in Javascript (zero-crossings) to estimate BPM, key, and energy.
    - **Base64 Cloud Analysis:** To bypass browser CORS blocks on the Files API, the raw audio file is converted to a Base64 string and sent as inline data to **Gemini 3 Pro** to "listen" and generate semantic tags.
4. **State Sync:** The consolidated DNA profile updates the **Zustand `audioIntelligenceSlice`** and populates the **Visualizer** dashboard for display.
