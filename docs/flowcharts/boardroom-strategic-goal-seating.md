# Boardroom Strategic Goal Seating Swarm Flowchart

This flowchart documents the definitive state transitions, dynamic agent seating patterns, and task dependency checks that govern the strategic launch swarm.

```mermaid
sequenceDiagram
    autonumber
    actor User as Real User (Conductor Hub)
    participant C as indii Conductor
    participant Cr as Creative Director
    participant R as Road Manager
    participant M as Marketing Specialist
    participant S as Social Specialist
    participant P as Pulse Engine

    User->>C: State Goal: "plan Detroit tour with album art"
    activate C
    Note over C: Turn 1: Seating phase
    C->>Cr: seat_agent("creative")
    activate Cr
    Cr-->>C: Creative Agent Seated
    deactivate Cr
    C->>R: seat_agent("road")
    activate R
    R-->>C: Road Agent Seated
    deactivate R
    C-->>User: Strategic Swarm Seated (Creative & Road Active)
    deactivate C

    User->>C: Prompt: "generate the art, plan Detroit advance"
    activate C
    Note over C: Turn 2: Task Execution Phase
    C->>Cr: Execute artwork generation
    Cr-->>C: General Album Imagery saved to Firebase Gallery
    C->>R: Plan Detroit venue advance
    R-->>C: Detroit tour routing confirmed & dates established
    C-->>User: Tasks complete (Art & Dates registered)
    deactivate C

    User->>C: Prompt: "Imagery and dates are locked. Trigger rollout."
    activate C
    Note over C: Turn 3: Pulse Dependency Evaluation
    C->>P: Check Parent Dependencies (Art + Routing)
    P-->>C: Unlocks: "Generate Tour Flyers with Dates"
    C->>M: seat_agent("marketing")
    activate M
    M-->>C: Marketing Agent Seated
    deactivate M
    C->>S: seat_agent("social")
    activate S
    S-->>C: Social Agent Seated
    deactivate S
    C-->>User: Rollout Specialists Seated (Marketing & Social Active)
    deactivate C

    User->>C: Prompt: "Generate rollout materials and schedule drafts"
    activate C
    Note over C: Turn 4: Rollout Execution Phase
    C->>M: Draft EPK materials
    M-->>C: EPK drafted and aligned
    C->>S: Schedule announcement flyers
    S-->>C: Draft flyer scheduled for Instagram/Twitter
    C-->>User: Campaign drafted & scheduled successfully
    deactivate C

    User->>C: Prompt: "We are done. Clear the boardroom table."
    activate C
    Note over C: Turn 5: Swarm Dismissal Phase
    C->>Cr: unseat_agent("creative")
    C->>R: unseat_agent("road")
    C->>M: unseat_agent("marketing")
    C->>S: unseat_agent("social")
    C-->>User: SWARM EXCUSED. Table restored to idle ('generalist' only).
    deactivate C
```

## Architectural Elements Verified

1. **Boardroom Seating Bounds**: The Conductor dynamically updates `activeAgents` in the state slice. Seating workers instead of heads is correctly checked by scope bounds.
2. **Pulse Task Dependency Checklist**: Downstream nodes evaluate completion bits on upstream resources (Firebase Gallery assets and Confirmed Tour Dates JSON fields) before unlocking tool calls.
3. **Stateless AI Routing Logic**: Multi-turn tool execution maintains context stability via the backward message lookback strategy during play runs.
