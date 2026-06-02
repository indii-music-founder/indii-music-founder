# Live Provider Blockers Startup Flowchart

This diagram maps the current Runtime Phase incidents reported on 2026-06-02: Gemini image generation billing exhaustion, indii Conductor per-minute rate-limit amplification, cost-control ledger failure, merch stats degradation, Audio Analyzer WASM CSP failure, and Google Maps authentication failure. It is intentionally a live-readiness map, not a CI-only validation map.

```mermaid
graph TD
    UserScreens["User screenshots and live errors"] --> StartWorkflow["/start workflow alignment"]
    StartWorkflow --> RuntimeGate{"Runtime Phase, not Scaffold Phase"}

    RuntimeGate --> GeminiPath["Direct image generation path"]
    RuntimeGate --> ConductorPath["indii Conductor chat path"]
    RuntimeGate --> CostPath["Agent chat cost-control path"]
    RuntimeGate --> MerchPath["Merch dashboard path"]
    RuntimeGate --> AudioPath["Audio Analyzer path"]
    RuntimeGate --> MapsPath["Touring map path"]

    GeminiPath --> DirectHook["useDirectGeneration.ts builds callable payload"]
    DirectHook --> ImageCallable["generateImageV3 Firebase callable"]
    ImageCallable --> GeminiAPI["Gemini API project billing"]
    GeminiAPI --> GeminiBlocked["429 RESOURCE_EXHAUSTED prepayment credits depleted"]
    GeminiBlocked --> GeminiUiFix["Frontend billing-specific error message"]
    GeminiBlocked --> GeminiAcceptance{"Acceptance: funded project or explicit billing blocker shown"}

    ConductorPath --> AgentService["AgentService.sendMessage"]
    AgentService --> GeneralistLoop["GeneralistAgent native function-calling loop"]
    GeneralistLoop --> StreamCall["AutonomousIntelligence.generateContentStream"]
    StreamCall --> RateLimitCheck["TokenUsageService.checkRateLimit"]
    RateLimitCheck --> BucketDoc["Firestore minute bucket userId_minute"]
    BucketDoc --> LimitBlocked["10 intelligence model calls per minute exceeded"]
    LimitBlocked --> LoopStopFix["Stop retries on rate-limit, quota, billing failures"]
    LimitBlocked --> ConductorAcceptance{"Acceptance: one visible user message cannot loop into repeated hidden retries"}

    CostPath --> DirectChat["AgentService direct chat flow"]
    DirectChat --> RemovedReservation["Removed duplicate pre-stream cost reservation"]
    DirectChat --> StreamOwnsLedger["FirebaseIntelligenceService owns stream cost reservation"]
    StreamOwnsLedger --> CostLedger["CostControlService costLedger Firestore documents"]
    CostLedger --> CostBlocked["Cost control system unavailable"]
    CostBlocked --> CostAcceptance{"Acceptance: one chat stream has one ledger reservation and clear provider/config error"}

    MerchPath --> MerchHook["useMerchandise.ts"]
    MerchHook --> RevenueStats["RevenueService.getUserRevenueStats"]
    RevenueStats --> MerchBlocked["Revenue stats load failure"]
    MerchBlocked --> MerchFallback["Zero-state stats, dashboard remains usable"]
    MerchFallback --> MerchAcceptance{"Acceptance: non-critical stats cannot blank the whole Merch module"}

    AudioPath --> AudioModule["AudioAnalysisService Essentia.js"]
    AudioModule --> ElectronCsp["Electron active CSP in csp.ts"]
    ElectronCsp --> WasmBlocked["WASM eval blocked by script-src"]
    WasmBlocked --> WasmFix["Allow wasm-unsafe-eval, not unsafe-eval"]
    WasmFix --> AudioAcceptance{"Acceptance: Audio Analyzer can initialize WASM under production CSP"}

    MapsPath --> TourMap["TourMap.tsx Google Maps wrapper"]
    TourMap --> MapsKey["VITE_GOOGLE_MAPS_API_KEY and feature flag"]
    MapsKey --> AppCheck["Firebase App Check and reCAPTCHA configuration"]
    AppCheck --> MapsBlocked["Map Authentication Failed fallback"]
    MapsBlocked --> MapsAcceptance{"Acceptance: valid Maps JavaScript API key and App Check config for environment"}

    GeminiAcceptance --> LiveReadiness["Live-readiness report"]
    ConductorAcceptance --> LiveReadiness
    CostAcceptance --> LiveReadiness
    MerchAcceptance --> LiveReadiness
    AudioAcceptance --> LiveReadiness
    MapsAcceptance --> LiveReadiness
    GeminiUiFix --> LiveReadiness
    LoopStopFix --> LiveReadiness
    RemovedReservation --> LiveReadiness
    MerchFallback --> LiveReadiness
    WasmFix --> LiveReadiness

    classDef user fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#001219
    classDef service fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#1a1025
    classDef data fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#211000
    classDef cloud fill:#e8f5e9,stroke:#00c853,stroke-width:2px,color:#001a08
    classDef error fill:#ffe4ef,stroke:#ff1493,stroke-width:2px,color:#2b0014
    classDef gate fill:#fffde7,stroke:#fbc02d,stroke-width:2px,color:#201800

    class UserScreens,StartWorkflow user
    class DirectHook,AgentService,GeneralistLoop,StreamCall,RateLimitCheck,TourMap,GeminiUiFix,LoopStopFix,DirectChat,RemovedReservation,StreamOwnsLedger,MerchHook,MerchFallback,AudioModule,WasmFix service
    class BucketDoc,CostLedger data
    class ImageCallable,GeminiAPI,MapsKey,AppCheck,RevenueStats,ElectronCsp cloud
    class GeminiBlocked,LimitBlocked,MapsBlocked,CostBlocked,MerchBlocked,WasmBlocked error
    class RuntimeGate,GeminiAcceptance,ConductorAcceptance,CostAcceptance,MerchAcceptance,AudioAcceptance,MapsAcceptance,LiveReadiness gate
```

## Transition Breakdown

1. The user-reported screenshots are the source of truth for this startup: one image-generation provider error, one Conductor rate-limit error after a visible `hi`, one agent side-panel cost-control failure after `hey`, one Merch dashboard revenue-stats failure, one Audio Analyzer CSP failure, and one map authentication fallback.
2. The direct image path starts in `packages/renderer/src/modules/creative/hooks/useDirectGeneration.ts`, calls the `generateImageV3` Firebase callable, and then depends on the Gemini API project billing state. A local payload-shape pass does not prove that the provider account has credits.
3. The Conductor path starts in `packages/renderer/src/services/agent/AgentService.ts`, routes through `packages/renderer/src/services/agent/specialists/GeneralistAgent.ts`, and can make multiple internal model calls for one visible message. Each model call hits `TokenUsageService.checkRateLimit`, which increments a Firestore minute bucket.
4. The immediate Conductor code risk is retry amplification: if a rate-limit failure is treated as non-fatal inside the function-calling loop, one visible user message can produce repeated hidden attempts before surfacing one fatal message.
5. The agent cost-control path previously reserved stream cost in `AgentService.handleDirectChatFlow` and then reserved again inside `FirebaseIntelligenceService.generateContentStream`. The direct-chat flow now delegates the reservation to the Intelligence service so one visible chat stream has one cost-ledger preflight.
6. The Merch dashboard path now treats revenue stats as non-critical: if `RevenueService.getUserRevenueStats` fails or times out, the dashboard uses zero-state stats instead of rendering the module-wide fatal error screen.
7. The Audio Analyzer path depends on Essentia.js WASM. The active Electron CSP must include `wasm-unsafe-eval` in production `script-src`; adding broad `unsafe-eval` would be an unnecessary security regression.
8. The map path starts in `packages/renderer/src/modules/touring/components/TourMap.tsx`. The fallback indicates Google Maps loaded far enough to report authentication failure, which points to API key, Maps JavaScript API enablement, referrer restrictions, App Check, or reCAPTCHA configuration for the current environment.
9. The Runtime Phase acceptance criteria are provider-backed: funded Gemini billing or honest billing-blocker UI, no repeated hidden Conductor retries after a rate-limit failure, one cost reservation per chat stream, dashboards degrade rather than blanking on non-critical stats failures, WASM libraries are allowed by production CSP, and Maps/App Check configuration is verified for the running environment.
