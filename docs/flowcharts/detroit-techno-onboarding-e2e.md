# Detroit Techno Onboarding E2E Flowchart

This flowchart outlines the E2E testing architecture for the Detroit Techno/House Onboarding loop, mapping the sequential steps of user profile injection, state verification, mock API intercepts, and Vite Hot Module Replacement (HMR) state reload safeguards.

```mermaid
graph TD
    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px;
    classDef logic fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px;
    classDef data fill:#fff3e0,stroke:#ffb300,stroke-width:2px;
    classDef ai fill:#e8f5e9,stroke:#4caf50,stroke-width:2px;
    classDef error fill:#fce4ec,stroke:#d81b60,stroke-width:2px;

    Runner["Playwright E2E Runner (e2e/detroit-techno-onboarding.spec.ts)"]:::logic
    DevServer["Vite Dev Server (localhost:4242)"]:::logic
    Store["Zustand Store (userProfile Slice)"]:::data
    RESTMock["Firestore REST Interceptor (Route Matcher)"]:::logic
    GenAIMock["GenAI REST Interceptor (google-genai)"]:::ai
    HMRWatch["Vite HMR Watcher (File changes)"]:::logic
    HMRSafe["HMR useStore Safeguard (page.waitForFunction)"]:::error

    Runner -->|"1. Launches browser & navigates to"| DevServer
    Runner -->|"2. Stubs loadUserProfile & injects Profile UID"| Store
    Runner -->|"3. Simulates onboarding chat turns"| DevServer
    DevServer -->|"4. Sends text prompt request"| GenAIMock
    GenAIMock -->|"5. Returns Turn Mock Option"| DevServer
    DevServer -->|"6. Saves profile state changes"| RESTMock
    RESTMock -->|"7. Returns cached current persona doc"| DevServer
    HMRWatch -.->|"Triggers transient page reload"| DevServer
    DevServer -.->|"Temporarily invalidates window.useStore"| Store
    Runner -->|"8. Runs Phase 7 validation"| HMRSafe
    HMRSafe -->|"Checks: window.useStore & .getState exist"| Store
    Store -->|"9. Returns final verified userProfile state"| Runner

    class Runner,DevServer,RESTMock,HMRWatch logic;
    class Store data;
    class GenAIMock ai;
    class HMRSafe error;
```

## Detailed Transition Walkthrough

1. **Test Bootstrap**: The Playwright runner launches the Chromium browser and navigates to the Vite development server running the studio application on port `4242`.
2. **Profile Inception & Mocking**: Immediately when the window object initializes, the test intercepts `window.useStore` to inject `test-user-uid-e2e` for the user session, stubs `loadUserProfile` to prevent remote Firestore overwrites, and sets up route listeners.
3. **Chat Simulation**: Playwright sequentially types bios, prompts, and clicks Turn options for each Detroit Techno / House persona.
4. **GenAI Interception**: The app calls the Google Developer Knowledge / GenAI client endpoints, which are intercepted in the E2E spec to return deterministic, safe mock choices mapped to the current artist profile's aesthetic goals (e.g. Vintage, Minimalist).
5. **Firestore REST Intercepts**: To sync the profile database document safely, REST Firestore updates/retrievals are intercepted on the fly.
6. **HMR Reload Safeguard**: In local developer environments, Vite file watcher checks (or HMR invalidations on contexts) can cause a transient reload. During reloads, `window.useStore` is temporarily unset. The runner uses `page.waitForFunction` to yield until `window.useStore` and `window.useStore.getState` are fully hydrated and functional on the window context, ensuring zero false-alarm test failures.
7. **Final Assertions**: Once verified, the runner asserts the profile data matches the initial Motor City artist criteria.
