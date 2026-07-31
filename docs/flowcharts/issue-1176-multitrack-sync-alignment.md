# ISSUE-1176 Multitrack & Sync Alignment Workflow

```mermaid
graph TD
    classDef client fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef cloud fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#f8fafc;
    classDef dsp fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#f8fafc;
    classDef db fill:#451a03,stroke:#fbbf24,stroke-width:2px,color:#f8fafc;

    Client["Studio / Video Editor UI"]:::client -->|"alignSessionMaster(sessionId, canonicalMasterRef)"| Function["Firebase Cloud Function<br/>alignSessionMaster"]:::cloud
    
    Function -->|"1. Validate Auth & Ownership"| Firestore[("Firestore<br/>videoSessions/{sessionId}")]:::db
    Function -->|"2. Check Existing Alignment"| AlignDoc[("Firestore<br/>alignments/{alignmentId}")]:::db
    
    AlignDoc -->|"Cached Match Found"| ReturnCached["Return Cached Alignment<br/>(reused: true)"]:::client
    
    Function -->|"3. POST /align"| DspWorker["Cloud Run DSP Engine<br/>engine-dsp"]:::dsp
    
    subgraph DspEngine ["DSP Audio Alignment Engine"]
        DspWorker -->|"Feature Extraction"| Extract["extract_timing_profile()<br/>librosa onset/chroma/STFT"]:::dsp
        Extract -->|"Windowed Cross-Corr"| Correlate["np.correlate()<br/>onset energy envelopes"]:::dsp
        Correlate -->|"Peak & Ambiguity Evaluation"| Evaluate["Calculate Offset (us), Drift (PPM),<br/>Residual P95 (us), Aggregate Confidence"]:::dsp
        Evaluate -->|"Auto-Lock Policy"| Confidence{"Confidence >= 0.80 &<br/>Residual <= 40ms?"}:::dsp
        Confidence -->|"Yes"| StatusLocked["status: 'locked'"]:::dsp
        Confidence -->|"No"| StatusReview["status: 'needs_review' / 'no_match'"]:::dsp
    end
    
    DspWorker -->|"Return JSON Alignment"| Function
    Function -->|"4. Parse Zod Schema"| Validate["MasterSyncAlignmentSchema.parse()"]:::cloud
    Validate -->|"5. Persist Immutable Receipt"| AlignDoc
    Function -->|"6. Return Result"| Client
```

## Step-by-Step Transition Breakdown

1. **Client Request**: Studio UI invokes `alignSessionMaster` Cloud Function with `sessionId` and `canonicalMasterRef`.
2. **Auth & Cache Lookup**: Firebase Function checks session ownership in Firestore and searches for an existing `MasterSyncAlignment` receipt for idempotent reuse.
3. **DSP Processing**: If not cached, the function posts to `engine-dsp` Cloud Run worker.
4. **DSP Onset & Cross-Correlation**: `AudioAlignmentPipeline` computes librosa STFT/onset features and windowed cross-correlation.
5. **Confidence Gating**: Evaluates offset, drift, and residual error. Auto-locks if confidence >= 0.80 and residual <= 40ms.
6. **Receipt Persistence & Return**: Validates output against `MasterSyncAlignmentSchema`, saves receipt to Firestore, and returns alignment result to the client.
