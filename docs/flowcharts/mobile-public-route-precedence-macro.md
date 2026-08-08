# Mobile Public Route Precedence

This map defines the renderer bootstrap decision that keeps public and authentication routes reachable on phones without weakening the explicit Mobile Remote Controller boundary.

```mermaid
flowchart TD
    Request["Browser opens an app URL"] --> ElectronGate{"Electron runtime?"}
    ElectronGate -->|"Yes"| Studio["Studio surface"]
    ElectronGate -->|"No"| ControllerPath{"Path is /mobile-remote?"}
    ControllerPath -->|"Yes"| Controller["Mobile Remote Controller"]
    ControllerPath -->|"No"| ProtectedPath{"Public, auth, tax upload, or OAuth callback path?"}
    ProtectedPath -->|"Yes"| AppRoute["App.tsx route branches"]
    ProtectedPath -->|"No"| DeviceGate{"Phone or touch tablet?"}
    DeviceGate -->|"Yes"| Redirect["Canonicalize to app.indii.music/mobile-remote"]
    Redirect --> Controller
    DeviceGate -->|"No"| Studio
    AppRoute --> Legal{"Legal route?"}
    Legal -->|"Yes"| LegalPage["Privacy or Terms page"]
    Legal -->|"No"| TaxRoute{"Tax upload route?"}
    TaxRoute -->|"Yes"| TaxPage["Public collaborator tax upload"]
    TaxRoute -->|"No"| AuthState{"Signed in?"}
    AuthState -->|"No"| LoginPage["Sign in or account creation"]
    AuthState -->|"Yes"| Callback{"Instagram OAuth callback?"}
    Callback -->|"Yes"| OAuthPage["Instagram callback handler"]
    Callback -->|"No"| Studio

    classDef input fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#102027
    classDef gate fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#1f1027
    classDef route fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#2c1900
    classDef controller fill:#fce4ec,stroke:#d81b60,stroke-width:2px,color:#2b0715
    class Request input
    class ElectronGate,ControllerPath,ProtectedPath,DeviceGate,Legal,TaxRoute,AuthState,Callback gate
    class Studio,AppRoute,LegalPage,TaxPage,LoginPage,OAuthPage route
    class Redirect,Controller controller
```

## Transition breakdown

1. `App.tsx` supplies `pathname`, Electron state, and the result of `isRemoteSurfaceDevice()` to `shouldUseMobileRemoteSurface()`.
2. Electron remains a Studio surface regardless of viewport heuristics. In web runtimes, an explicit `/mobile-remote` pathname has the highest route priority and always selects the Controller.
3. The routing policy next checks the normalized pathname. Legal pages (`/privacy`, `/legal/privacy`, `/terms`, `/legal/terms`), the collaborator `/tax-form-upload` route, authentication aliases (`/login`, `/signin`, `/signup`, `/register`), and provider callback paths under `/auth/{provider}/callback` are protected from device-based Controller routing.
4. Only paths that are neither explicit Controller nor protected app routes reach device classification. Phones and touch-capable tablets select the Controller and, outside local development, are canonicalized to `https://app.indii.music/mobile-remote` while preserving search and hash parameters.
5. Protected paths continue through the existing `App.tsx` branch order: legal content and collaborator upload bypass authentication, signed-out auth paths render `LoginForm`, and the signed-in Instagram callback renders its callback handler.
6. `isStudioExecutorSurface()` consumes the final surface decision. Controller pages remain command producers and cannot publish Studio presence; the routing exemption changes presentation reachability only, not remote-command trust boundaries.

## Verification contract

- Pure routing tests cover every protected path, trailing-slash normalization, explicit Controller precedence, ordinary phone app routing, Electron, and desktop web.
- A real browser pass uses a phone viewport against the local production-shaped renderer: protected routes must keep their pathname and must not show “Studio Disconnected”; `/mobile-remote` must still render the Controller.
- Desktop checks confirm the same protected content remains reachable and normal Studio routing is unchanged.
