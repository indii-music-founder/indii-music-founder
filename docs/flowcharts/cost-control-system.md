# Universal Cost Control & Kill-Switch System

This flowchart maps the `CostControlService`, which acts as the universal safety net and kill-switch across the entire indii platform. It prevents runaway AI agents from accumulating massive bills by enforcing hard budget caps at the Cloud Function level *before* any expensive operation executes.

```mermaid
graph TD
    %% Trigger Layer
    subgraph Trigger ["Agent / Client Request"]
        Video["Video Generation Request (Veo 4k)"]
        Image["Image Generation Request (Imagen 3)"]
        Stream["Agent Stream (Gemini 2.5)"]
    end

    %% Check Layer
    subgraph PreFlight ["Pre-Flight Cost Check (`CostControlService`)"]
        Estimate["Calculate Estimated Cost"]
        CheckTiers["Compare to User Tier & Budgets"]
        KillSwitch["Global Runaway Kill-Switch Check ($500)"]
    end

    %% Source of Truth
    subgraph Ledger ["Firestore Cost Ledger"]
        Daily["Daily Spend `/daily/{date}`"]
        Monthly["Monthly Spend `/monthly/{month}`"]
        Ops["Operation Log `/operations/{opId}`"]
    end

    %% Execution Layer
    subgraph Execution ["Execution & Enforcement"]
        Approved["APPROVED: Reserve Cost & Proceed"]
        Blocked["BLOCKED: Operation Terminated"]
        CloudFunc["Cloud Function Final Enforcement"]
        GCP["GCP Project Quota Limits (Hard Stops)"]
    end

    %% Alerting
    subgraph Alerting ["Anomaly Monitoring"]
        PubSub["5-Min Interval Pub/Sub Check"]
        Thresholds["Thresholds: 80% (Warn) / 100% (Kill)"]
        Slack["Slack / Admin Incident Alerts"]
    end

    %% Flow
    Video & Image & Stream -->|"1. Must call `checkAndReserve()`"| Estimate
    
    Estimate -->|"2. Query current spend"| Ledger
    Ledger -.->|"Returns actuals"| CheckTiers
    
    CheckTiers -->|"3. Evaluate Limits"| KillSwitch
    
    KillSwitch -->|"> $500 monthly total"| Blocked
    KillSwitch -->|"> Daily/Hourly limit"| Blocked
    KillSwitch -->|"< Limits"| Approved
    
    Approved -->|"4. Update Ledger"| Ledger
    Approved -->|"5. Hand off to"| CloudFunc
    
    CloudFunc -->|"6. Final server-side check"| GCP
    GCP -->|"7. Execute API Call"| Output["Generated Asset / Stream"]

    %% Monitoring Flow
    Ledger -.->|"Polled by"| PubSub
    PubSub --> Thresholds
    Thresholds -->|"If breached"| Slack

    %% Styling
    style Trigger fill:#8A2BE2,color:#FFF
    style PreFlight fill:#FF00FF,color:#FFF
    style Ledger fill:#39FF14,color:#000
    style Execution fill:#00D4FF,color:#000
    style Alerting fill:#FF8C00,color:#000
    style Blocked fill:#FF3333,color:#FFF
    style KillSwitch fill:#FF3333,color:#FFF
```

## Transition Breakdown

1. **Pre-Flight Estimation:** Before an agent triggers a costly API call (like generating a 60-second 4K video using Vertex AI), it must first call `CostControlService.checkAndReserve()` with an estimated cost based on the `OPERATION_COSTS` catalog.
2. **Ledger Verification:** The service queries the real-time Firestore Cost Ledger to calculate the user's total daily and monthly spend.
3. **The Kill-Switch:** The system checks the estimated cost against the user's specific tier limits (Free, Pro, Enterprise). Regardless of tier, it evaluates the **Global Runaway Kill-Switch** (set at $500/month). If the new operation would push the monthly spend over $500, it instantly terminates with a `RUNAWAY_KILL_SWITCH` error.
4. **Reservation & Execution:** If approved, the system immediately increments the ledger to reserve the funds. The request is passed to the secure Cloud Function layer (`enforceOperationCost`), which performs a final server-side validation to prevent client-side tampering.
5. **GCP Quotas:** As an absolute final backstop, hard quotas are configured at the GCP level via Terraform (e.g., maximum 1,000 Veo requests per month per project).
6. **Anomaly Monitoring:** A background Pub/Sub job runs every 5 minutes, scanning the ledger. If spend velocity spikes or thresholds (80%, 95%, 100%) are breached, it generates high-severity incident alerts.
