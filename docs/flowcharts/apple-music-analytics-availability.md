# Apple Music Analytics Availability

This flowchart maps how Apple Music analytics now fail closed until a secured Apple Music for Artists backend can provide real partner metrics.

```mermaid
graph TD
    User["User Opens Platform Connector"] --> Connector["PlatformConnector"]
    Connector --> UnavailableCard["Apple Music Unavailable Card"]
    UnavailableCard --> DisabledAction["Disabled Connect Action"]

    Catalogue["PlatformDataService Build Catalogue"] --> StatusGate{"Apple Music Connected?"}
    StatusGate -->|"No"| OmitPlatform["Omit Apple Music Breakdown"]
    StatusGate -->|"Yes"| BuildPlatform["AppleMusicService Build Platform Data"]
    BuildPlatform --> PartnerGate{"Partner Analytics Returned?"}
    PartnerGate -->|"Yes"| RealData["Return Real PlatformData"]
    PartnerGate -->|"No"| NullData["Return Null Availability Result"]
    NullData --> OmitPlatform
    RealData --> Prorate["Spotify-Led Account Metric Proration"]
    Prorate --> TrackBreakdown["Include Apple Music In Track Platforms"]

    HistoryRequest["AppleMusicService Build Stream History"] --> HistoryGate{"Partner History Returned?"}
    HistoryGate -->|"Yes"| RealHistory["Return Real StreamDataPoint Array"]
    HistoryGate -->|"No"| NullHistory["Return Null History Result"]

    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#111827;
    classDef service fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#111827;
    classDef gate fill:#fce4ec,stroke:#c2185b,stroke-width:2px,color:#111827;
    classDef data fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#111827;

    class User,Connector,UnavailableCard,DisabledAction ui;
    class Catalogue,BuildPlatform,HistoryRequest service;
    class StatusGate,PartnerGate,HistoryGate gate;
    class OmitPlatform,RealData,NullData,Prorate,TrackBreakdown,RealHistory,NullHistory data;
```

## Transition Breakdown

1. `PlatformConnector` renders Apple Music as unavailable and disables the connect button until a secured Apple Music for Artists backend exists.
2. `PlatformDataService` still asks Apple Music for platform data when the connection status says Apple Music is available, but treats a `null` response as an honest unavailable state.
3. `AppleMusicService.buildPlatformData()` returns partner analytics unchanged when `fetchPartnerAnalytics()` provides real `PlatformData`.
4. If no partner analytics are returned, `AppleMusicService.buildPlatformData()` returns `null` instead of deriving streams from library size or any other client-side estimate.
5. `PlatformDataService` omits Apple Music from track platform breakdowns when the service returns `null`, keeping aggregate totals free of fabricated Apple Music numbers.
6. When real partner `PlatformData` exists, `PlatformDataService` keeps the existing Spotify-led account-metric proration path and labels the per-track values as synthetic account-metric estimates.
7. `AppleMusicService.buildStreamHistory()` returns real partner history unchanged when available; otherwise it returns `null` instead of generating zero-filled historical data.
