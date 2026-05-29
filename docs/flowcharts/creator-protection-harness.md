# Creator Protection Harness Deep-Dive

This flowchart represents a deep-dive into the `Creator Protection` harness, which is currently categorized as a **Done** harness in the architectural plan. It illustrates how specific domain logic maps directly onto the Universal Harness Compiler pipeline.

```mermaid
graph TD
    %% Input Layer
    subgraph Adapter ["1. Input Adapter (Data Gathering)"]
        Profile["Identity Protection Profile"]
        Assets["Protected Persona Assets"]
        Consent["Voice/Likeness Consent Records"]
        Incidents["Takedown / AI Incidents"]
        
        Profile & Assets & Consent & Incidents --> Normalize["Normalize to Compiler Input"]
    end

    %% Compiler Layer
    subgraph Compiler ["2. Legal Domain Compiler"]
        Analyze["Assess Profile & Incident Severity"]
        Classify["Classify Takedown Types"]
        
        Classify -.->|"Voice Clone"| Route1["Route: DMCA / Attorney"]
        Classify -.->|"Name Confusion"| Route2["Route: Platform Policy"]
        Classify -.->|"Authorized Use"| Route3["Route: Dismiss / Monitor"]
        
        Analyze --> LegalSnap["Capture Legal Source Snapshots"]
        Route1 & Route2 & Route3 --> Calc["Calculate Readiness & Confidence"]
    end

    %% Builder Layer
    subgraph Builder ["3. HarnessRun Builder"]
        Findings["Draft Findings (e.g., Unlicensed Voice Clone)"]
        Evidence["Attach Evidence Packets"]
        Brief["Construct Agent Brief (Owner: Legal)"]
        Gate["Attach Approval Gate (Required for Notice Sending)"]
        
        Findings & Evidence & Brief & Gate --> FinalRun["Normalized CreatorProtectionRun"]
    end

    %% Persistence & Consumption
    subgraph Output ["4. Execution & Consumption"]
        Save["Save to Firestore `replicaIncidents`"]
        Boardroom["Feed to Boardroom Meta-Harness"]
        UI["Creator Protection Center (User Vault & Alerts)"]
    end

    %% Transitions
    Normalize --> Analyze
    Calc --> Findings
    LegalSnap --> Evidence
    
    FinalRun --> Save
    FinalRun --> Boardroom
    FinalRun --> UI

    %% Approval Gate Rule
    subgraph Security ["Strict Rule"]
        GateBlock["No legal notice can be sent without explicit user approval via the Gate"]
    end
    Gate -.-> GateBlock

    %% Styling
    style Adapter fill:#FF00FF,color:#FFF
    style Compiler fill:#FF00FF,color:#FFF
    style Builder fill:#FF00FF,color:#FFF
    style Output fill:#39FF14,color:#000
    style Security fill:#FF3333,color:#FFF,stroke-dasharray: 5 5
```

## Transition Breakdown

1. **Input Adaptation:** The adapter gathers highly sensitive data—biometric consent records, known authorized AI replica licenses, and active infringement incidents—and normalizes them safely.
2. **Domain Compilation (The Legal Logic):** 
   - The compiler categorizes incidents (e.g., copyright vs. right of publicity vs. platform terms of service). 
   - It captures **Legal Source Snapshots**, ensuring that the state of the law or platform policy at the time of the incident is preserved immutably.
   - It calculates the legal readiness score and defines the boundaries of what an attorney must review.
3. **HarnessRun Building:** The compiler maps its findings into the generic `HarnessRun` schema. 
   - It attaches strict **Evidence Packets**.
   - It drafts the `HarnessAgentBrief` for the LegalAgent.
   - **Crucially:** It drafts the takedown notice but *attaches a strict Approval Gate*. The system guarantees that no automated DMCA or legal threat will ever be dispatched without explicit user intervention.
4. **Output & Consumption:** The finalized `CreatorProtectionRun` is saved, fed directly to the Boardroom for cross-domain evaluation, and rendered in the user-facing "Creator Protection Center" UI.
