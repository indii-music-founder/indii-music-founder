# Flowchart: Tour Map Integration (Micro Architecture)

Micro-architecture flow of user location inputs, stop selections, and quick action coordinates parsed and rendered dynamically inside the `TourMap` component.

```mermaid
graph TD
    %% Inputs & Entrypoints
    A["User Input (City Name or lat,lng)"] -->|currentLocation| B["OnTheRoadTab / PlanningTab"]
    A2["Itinerary Stops (Stops array)"] -->|locations / markers| B
    
    %% TourMap Prop Routing
    B -->|center, currentLocation, markers, locations| C["TourMap Wrapper"]
    C -->|spread props| D["MapComponent"]
    
    %% Map Initialization
    D --> E{"Map instance exists?"}
    E -->|No| F["Initialize google.maps.Map"]
    F --> G["Parse initial center (Safely handle coords or string)"]
    G --> H["Mount Map on ref container"]
    E -->|Yes| I["Skip Initialization"]
    
    %% Center & Zoom Updates Effect
    D --> J["Center/Zoom Effect"]
    J --> K{"center type?"}
    K -->|Coords Object| L["map.panTo(coords)"]
    K -->|Coords String| M["Parse coords & map.panTo(parsed)"]
    K -->|Address String| N["google.maps.Geocoder.geocode()"]
    N -->|On OK| O["map.panTo(result.location)"]
    
    %% Markers & Circles Updates Effect
    D --> P["Markers/Circles Update Effect"]
    P --> Q["Clear existing markers & circles"]
    
    %% 1. Static Markers
    Q --> R["Draw static markers from props.markers"]
    R --> R1{"Is marker current?"}
    R1 -->|Yes & rangeRadiusMiles| R2["Draw orange range circle"]
    R1 -->|No| R3["Draw venue / gas / hotel icon"]
    
    %% 2. currentLocation
    Q --> S["Draw currentLocation marker & circle"]
    S --> S1{"currentLocation type?"}
    S1 -->|Coords Object/String| S2["Draw blue dot marker + range circle"]
    S1 -->|Address String| S3["Geocode currentLocation address"]
    S3 -->|On OK| S4["Draw blue dot marker + range circle"]
    
    %% 3. Legacy locations
    Q --> T["Geocode legacy locations array"]
    T -->|On OK| T1["Draw numbered markers"]
    
    %% Bounds Adjustments
    R & S2 & S4 & T1 --> U["Extend LatLngBounds"]
    U --> V["Promise.all(Geocoding) completes?"]
    V -->|Yes| W["map.fitBounds(bounds)"]
    W --> X{"Total items === 1?"}
    X -->|Yes| Y["map.setZoom(12)"]
    X -->|No| Z["Default bounds zoom"]
```

## State Transitions & Lifecycles

### 1. Map Mount & Initialization
- **Ref Connection Check**: Verifies `ref.current.isConnected` before creating the map instance.
- **Sentinel Active Mounting Flag**: The `active` flag prevents setting map state or rendering markers on unmounted or disconnected DOM containers during fast tab switching.

### 2. Coordinate Resolution & Geocoding Pipeline
- **Sync Coordinate Extraction**: Regex-like coordinate split (`latitude, longitude`) resolves immediately, avoiding asynchronous network latency for GPS queries.
- **Async Geocoding Fallback**: Addresses like `"Austin, TX"` trigger `google.maps.Geocoder.geocode()`. On callback, the results extend the bounds map view asynchronously.

### 3. Cleanup Routine
- Executed on component unmount:
  - Detaches all marker listeners: `google.maps.event.clearInstanceListeners(marker)`
  - Detaches all circle listeners: `google.maps.event.clearInstanceListeners(circle)`
  - Removes overlays from the map canvas: `marker.setMap(null)` and `circle.setMap(null)`
