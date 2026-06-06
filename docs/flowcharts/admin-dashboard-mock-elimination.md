# Admin Dashboard Mock Data Elimination Flowchart

```mermaid
graph TD
    A[Client Request to admin-dashboard] --> B{Endpoint Type}
    
    %% Google Workspace Endpoints
    B -->|Workspace Reads| C{Authorized?}
    C -->|Yes| D[Query Gmail/Calendar/Drive APIs]
    D -->|Success| E[Return Real Data]
    C -->|No| F[Return Empty Array: messages/events/files]
    
    B -->|Workspace Writes| G{Authorized?}
    G -->|Yes| H[Execute Workspace Write API]
    G -->|No| I[Return 412 Precondition Failed]
    
    %% Firestore Endpoints
    B -->|Firestore Queries| J[Query Firestore Collection: messages/deliveries/system_events]
    J -->|Success & Has Data| K[Return Real Records]
    J -->|Success & Empty| L[Return Empty Array]
    J -->|Firestore Error / Catch| M[Return Empty Array]

    %% Frontend UI Handling
    F --> N[GoogleHub UI Check]
    N -->|authorized is false| O[Render Workspace Unlinked Panel]
    N -->|authorized is true & empty| P[Render Premium Empty State]

    L --> Q[Modules UI Check]
    M --> Q
    Q --> R[Render Honest Zeros / Empty Queue State]
```

## Description
This diagram details the new clean routing paths for the `admin-dashboard` system after the removal of all mock database fallbacks.
1. **Workspace Reads/Writes**: Ensure unlinked state doesn't leak mock data, returning empty arrays and a `412` HTTP status for write attempts. The `GoogleHub` frontend checks this status and prevents tabs from rendering empty templates, replacing them with a unified "Link Workspace Account" helper.
2. **Firestore Collections**: All messaging logs, direct deliveries, and system logs are retrieved directly from Firestore. Any query errors or empty datasets gracefully fallback to empty structures, letting the UI render honest zero states rather than placeholders.
