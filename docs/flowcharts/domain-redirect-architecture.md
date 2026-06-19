# Domain Redirect Architecture

Purpose: Maps the multi-domain hosting environment in Firebase and how the Javascript Redirect Shield forces all default `.web.app` traffic onto the canonical custom domains.

```mermaid
graph TD
    %% Entry Points
    UserApp["User accesses Studio App"]
    UserLanding["User accesses Marketing Site"]

    %% App Traffic
    UserApp --> AppDefault["indii-music-studio.web.app"]
    UserApp --> AppCanonical["indii.music / www.indii.music"]

    %% Landing Traffic
    UserLanding --> LandingDefault["indii-music-founder.web.app"]
    UserLanding --> LandingCanonical["founder.indii.music"]

    %% App Redirect Logic
    AppDefault -->|JS Redirect Shield| AppCanonical
    AppCanonical --> AppFirebaseHosting["Firebase Hosting (app target)"]
    AppFirebaseHosting --> AppReact["Studio React Bundle"]

    %% Landing Redirect Logic
    LandingDefault -->|JS Redirect Shield| LandingCanonical
    LandingCanonical --> LandingFirebaseHosting["Firebase Hosting (landing target)"]
    LandingFirebaseHosting --> LandingVite["Landing React Bundle"]

    %% Styling
    classDef userAccess fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    classDef defaultDomain fill:#ffebee,stroke:#d81b60,stroke-width:2px,stroke-dasharray: 5 5
    classDef canonicalDomain fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    classDef redirectLogic fill:#fff3e0,stroke:#ff8f00,stroke-width:2px
    classDef hostingTarget fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px

    class UserApp,UserLanding userAccess
    class AppDefault,LandingDefault defaultDomain
    class AppCanonical,LandingCanonical canonicalDomain
    class AppFirebaseHosting,LandingFirebaseHosting,AppReact,LandingVite hostingTarget
```

## Transition Breakdown

1. **Default Domains (Red Dashed):** Firebase automatically provisions `.web.app` and `.firebaseapp.com` domains. These are treated as "dirty" URLs that users should never see.
2. **Javascript Redirect Shield (Orange):** Because `firebase.json` cannot conditionally redirect based on hostname (only path), a lightweight JS script executes in `<head>` before React mounts. If it detects a `.web.app` or `.firebaseapp.com` host, it executes `window.location.replace()` to the canonical custom domain, preserving path and query parameters.
3. **Canonical Domains (Green):** The only domains that actually serve the React bundle to the DOM.
4. **Console Configuration:** `www.indii.music` is explicitly mapped via Firebase Console to 301 redirect to `indii.music` at the DNS/CDN level to prevent the JS shield from even needing to fire for `www` typos.
