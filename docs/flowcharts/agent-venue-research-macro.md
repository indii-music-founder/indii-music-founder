# Agent Venue Research (Macro)

This flowchart illustrates the end-to-end process of dropping a pin on the Mobile Remote, having an autonomous agent research venues in that area using web search, and rendering the results on an interactive map in the Desktop Studio.

```mermaid
graph TD
    subgraph MobileApp ["Mobile Remote"]
        UI_Pin["Drop Pin Button"]
        Nav_Geo["navigator.geolocation"]

        UI_Pin -- "Requests" --> Nav_Geo
        Nav_Geo -- "Lat/Lng" --> UI_Pin
    end

    subgraph FirebaseCloud ["Firebase (The Vault)"]
        FS_Queue["Firestore:\nagent_dispatch_queue"]
        FS_Leads["Firestore:\nagent_scout_leads"]
    end

    UI_Pin -- "1. Dispatches venue_log" --> FS_Queue

    subgraph DesktopExecutor ["Desktop Studio (Local)"]
        Hook_Listener["useRemoteCommandListener"]
        Agent_Conductor["Agent Conductor"]
        Agent_Scout["Scout Agent"]
        MCP_Search["MCP: Exa Search"]
        UI_Map["TourMap (react-leaflet)"]

        Hook_Listener -- "2. Intercepts venue_log" --> Agent_Conductor
        Agent_Conductor -- "3. Delegates Task" --> Agent_Scout
        Agent_Scout -- "4. 'Find venues near Lat/Lng'" --> MCP_Search
        MCP_Search -- "5. Returns Venues" --> Agent_Scout
    end

    Agent_Scout -- "6. Saves Venues" --> FS_Leads
    FS_Leads -- "7. Syncs Realtime" --> UI_Map
```

## Transition Breakdown
1. **Drop Pin:** The user taps "Drop Pin" on their mobile device. The app gets exact GPS coordinates and sends them to the `agent_dispatch_queue`.
2. **Desktop Intercept:** The Desktop Executor silently picks up the coordinate payload.
3. **Agent Delegation:** The task is routed to the `Scout Agent` (or Generalist acting as Scout).
4. **Agent Research:** The agent formulates a web search via the `mcp_exa` tool to find "live music venues, clubs, and bars near [Latitude, Longitude]".
5. **Data Storage:** The agent structures the returned data and saves it into the `agent_scout_leads` collection in Firestore.
6. **Visualization:** The `TourMap` component (upgraded with an interactive `react-leaflet` map) automatically syncs with Firestore and renders the newly researched venues as clickable pins.
