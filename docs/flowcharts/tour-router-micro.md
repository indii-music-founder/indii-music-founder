# Algorithmic Tour Router & Merch Forecaster Flowchart

This diagram outlines the micro-architecture of the `indii` Tour Router. It maps how user inputs on the frontend combine with DSP listener data from BigQuery and the Google Maps API to generate a profitable, hub-and-spoke tour route.

```mermaid
graph TD
    %% User Actions
    Trigger["Click 'Route My Tour'"] --> InputDates["Input: Starting City, Dates, Vehicle MPG"]
    InputDates --> ZustandStore["Zustand: useTourStore()"]
    
    %% Service Layer & BigQuery
    ZustandStore --> TourService["TourRoutingService.generateRoute()"]
    TourService --> FetchData["Fetch Listener Geo-Data"]
    FetchData --> BigQuery["BigQuery: DSP Listener Density by ZIP"]
    
    %% Mapping & Prediction
    BigQuery -- "Returns Top 5 Dense Markets" --> MapService["Google Maps Distance Matrix API"]
    MapService -- "Calculates Drive Time/Fuel" --> Predictor["Predictive Merch Engine (Python/Cloud Run)"]
    
    Predictor --> BreakEvenCalc{"Check Break-Even"}
    
    %% Routing Gates
    BreakEvenCalc -- "Profitable" --> RouteValid["Build Optimal Hub-and-Spoke Path"]
    BreakEvenCalc -- "Loss Projected" --> RouteInvalid["Drop Weakest Market, Recalculate"]
    RouteInvalid --> MapService
    
    %% UI Update
    RouteValid --> SaveState["Zustand: updateRouteState()"]
    SaveState --> RenderMap["React: Render Canvas Map & Export PDF"]

    %% Styling Classes
    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#000
    classDef state fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#000
    classDef db fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef api fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef ai fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000
    
    class Trigger,InputDates,RenderMap ui
    class ZustandStore,SaveState,TourService state
    class BigQuery db
    class MapService api
    class Predictor,BreakEvenCalc ai
```

## Transition Breakdown
1. **User Action:** The artist sets the baseline constraints (start city, timeline, vehicle fuel efficiency) via the React UI.
2. **Data Aggregation:** `TourRoutingService` queries BigQuery, which holds normalized listener demographic data from Spotify/Apple, finding the highest concentration of fans within a 300-500 mile radius.
3. **Logistics & AI:** The Google Maps Distance Matrix API calculates optimal driving routes and fuel costs. The Cloud Run predictive engine then models expected merch sales based on historic conversion rates in those specific ZIP codes.
4. **Self-Healing Loop:** If the algorithm detects a net financial loss, it automatically drops the lowest-performing city and re-runs the route until a profitable Hub-and-Spoke model is established.
5. **Resolution:** The validated route updates the Zustand state, rendering the interactive map on the canvas.
