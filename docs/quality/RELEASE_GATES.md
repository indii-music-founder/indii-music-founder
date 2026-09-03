# indii.music — Production Release Gates & Verification Standard

**Document Version:** 2.0.0  
**Status:** ACTIVE SPECIFICATION  
**Enforcement Authority:** Mainline Delivery Standard & Real-User Authenticity Standard

---

## 1. Release Philosophy & Core Invariants

Before any binary, package, or cloud deployment is marked production-ready, it must pass through an automated verification pipeline and an authenticated real-user verification protocol.

### Inviolable Rules:
1. **The McLear Rule:** Never declare victory. Report exact status, test metrics, and known caveats.
2. **Real-User Authenticity Standard:** Mocks, synthetic sessions, bypassed authentication, and fabricated service responses are strictly forbidden for acceptance claims.
3. **Fail-Closed Security:** Any failure in security rules, credential handling, or IPC validation immediately aborts the release.

---

## 2. Automated Release Gates (CI/CD Pipeline)

Every candidate commit on `main` must pass all seven automated gates sequentially. A failure at any gate halts the build.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Gate 0: Dep  │ ──> │ Gate 1: Sec  │ ──> │ Gate 2: Type │ ──> │ Gate 3: Lint │
│ & Drift Init │     │ Guardrails   │     │ (9 Packages) │     │ & Hygiene    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
┌──────────────┐     ┌──────────────┐     ┌──────────────┐             │
│ Gate 6: Prod │ <── │ Gate 5: Rules│ <── │ Gate 4: Test │ <───────────┘
│ Build & Pack │     │ Emulator     │     │ Suites (Unit)│
└──────────────┘     └──────────────┘     └──────────────┘
```

### Gate 0: Dependency & Version Integrity
- **Objective:** Verify workspace lockfile consistency, ensure zero dependency version drift across workspaces, and guarantee that no Gen 1 Firebase Functions exist.
- **Commands:**
  ```bash
  npm run check:dep-drift
  npm run check:dep-integrity
  npm run check:no-gen1
  npm run check:fn-memory
  npm run check:gen2-semantics
  ```
- **Acceptance Criteria:**
  - Exit code `0` for all checks.
  - All Cloud Functions declare memory >= 512MiB, CPU `gcf_gen1`, and concurrency `1`.

### Gate 1: Security Guardrails & Architectural Boundaries
- **Objective:** Prevent backend API leakage into frontend bundles, enforce Vertex-only backend routing, and validate agent capabilities.
- **Commands:**
  ```bash
  npm run validate:mainline-workflows
  npm run validate:capabilities
  npm run security:frontend-api-boundary
  npm run security:vertex-only
  npm run security:vertex-routing
  ```
- **Acceptance Criteria:**
  - Zero unapproved API references in frontend bundles.
  - Zero direct Google AI Studio API calls (all AI inference routed through Vertex AI backend).
  - Clean capabilities mapping.

### Gate 2: Monorepo Typecheck
- **Objective:** Guarantee total static type safety across all TypeScript packages and backend tests without emitting any compiler errors.
- **Command:**
  ```bash
  npm run typecheck
  ```
  *(Executes `tsc -b` on `packages/shared`, `packages/video-compiler`, `packages/main`, `packages/renderer`, `packages/firebase`, `packages/render-worker`, `packages/sdk`, `packages/admin-dashboard`, plus `packages/firebase/tsconfig.test.json`)*
- **Acceptance Criteria:** Exit code `0`, `0` errors.

### Gate 3: ESLint & Code Standards
- **Objective:** Enforce formatting, modern language features, and ban unsafe global browser variables inside isolated services.
- **Command:**
  ```bash
  npm run lint
  ```
- **Acceptance Criteria:**
  - `0` errors across `packages/main`, `packages/renderer`, `packages/shared`, `packages/firebase`, `packages/landing`, `packages/sdk`, and `packages/admin-dashboard`.

### Gate 4: Unit & Integration Test Suites
- **Objective:** Execute full Vitest suites for all packages in isolated OS forks.
- **Command:**
  ```bash
  npm run test:ci
  ```
- **Acceptance Criteria:**
  - All unit test files pass (>6,700 passed tests).
  - Zero unhandled promise rejections.
  - Coverage thresholds satisfied: statements >= 60%, branches >= 70%, functions >= 60%, lines >= 60%.

### Gate 5: Firestore & Storage Rules Emulator Verification
- **Objective:** Verify that live Firestore and Storage emulator instances enforce multi-tenant isolation, immutable ownership fields, and denial of direct client writes to server-authoritative collections.
- **Command:**
  ```bash
  npm run test:rules
  ```
- **Acceptance Criteria:**
  - All 133+ emulator rules test cases pass.
  - Cross-user reads/writes denied (`permission-denied`).
  - Anonymous tokens blocked from private endpoints.

### Gate 6: Production Build & Asset Packaging
- **Objective:** Build minified, tree-shaken production bundles for Landing, Studio, and Desktop distributions.
- **Commands:**
  ```bash
  npm run build:shared
  npm run build:landing
  npm run build:studio
  npm run build:electron
  ```
- **Desktop Packaging Verification (Platform Specific):**
  - macOS: `npm run build:desktop:mac` (Produces notarized/signed DMG and ZIP in `dist-electron/`).
  - Windows: `npm run build:desktop:win` (Produces NSIS installer in `dist-electron/`).
- **Acceptance Criteria:**
  - Bundle size budgets satisfied (Studio main bundle < 1.5MB initial JS transfer).
  - ASAR unpacking verifies presence of `ffmpeg-static` and `ffprobe-static` inside `app.asar.unpacked`.
  - Zero missing source maps or dangling dynamic imports.

---

## 3. Real-User Authenticity Protocol (Manual Release Gates)

Automated tests provide structural confidence; real-user validation certifies that customer value actually works. The following journeys must be verified using real credentials and hardware:

| Journey Gate | Required Hardware / Credentials | Real-User Action & Verification Standard |
|---|---|---|
| **Gate 7A: Remote Pairing** | Physical iOS/Android Device + Physical Mac/Win running Electron | 1. Sign in to Studio on desktop Electron.<br>2. Sign in to `/remote` on mobile phone with the same account.<br>3. Verify desktop status changes to "Connected" on phone.<br>4. Issue command "navigate to finance". Confirm desktop immediately opens Finance module.<br>5. Minimize desktop window to system tray. Send message "ping". Verify desktop answers from tray without throttling. |
| **Gate 7B: Stripe Checkout & Credit Minting** | Real test/live credit card on Stripe sandbox | 1. Open Studio Billing modal.<br>2. Select Start / Build / Scale subscription or a Credit Top-Up pack.<br>3. Complete Stripe Checkout.<br>4. Inspect Stripe webhook log: verify signature verified, line items retrieved, and `user_credits/{uid}` updated atomically.<br>5. Refresh Studio: verify balance updates without duplicate credits on reload. |
| **Gate 7C: Print-on-Demand Merch Draft** | Real Printful Store API Key | 1. Configure Printful API key in Settings.<br>2. Design a merchandise item in Merchandise Studio.<br>3. Submit to Printful.<br>4. Verify the item appears in Printful dashboard in "Draft" state (not placed as an unconfirmed order). |
| **Gate 7D: US Copyright Office (eCO)** | Real artist catalog track (WAV) | 1. Open Registration Center &rarr; US Copyright Office.<br>2. On Desktop: verify BrowserAgent fills out eCO form fields.<br>3. On Web: verify form snapshot is saved in Firestore and user is provided direct link to `https://www.copyright.gov/registration/` with clear instructions. |
| **Gate 7E: Local Audio Processing & Privacy** | Real uncompressed WAV/FLAC master (>50MB) | 1. Import WAV into Audio Analyzer.<br>2. Verify FFmpeg executes locally: EBU R128 integrated loudness (LUFS) and true peak (dBFS) are calculated.<br>3. Check network tab: verify the raw audio file was NOT sent across the network.<br>4. Cancel analysis mid-flight: verify FFmpeg process terminates immediately and UI gracefully resets. |

---

## 4. Emergency Rollback Procedures

If a critical flaw or security defect bypasses release gates and reaches production:

1. **Firebase Hosting Rollback:**
   ```bash
   firebase hosting:clone indii-music-studio:PREVIOUS_VERSION_ID indii-music-studio:live
   firebase hosting:clone indii-music-founder:PREVIOUS_VERSION_ID indii-music-founder:live
   ```
2. **Cloud Functions Rollback:**
   Re-deploy from the previous release commit:
   ```bash
   git checkout <LAST_KNOWN_STABLE_SHA>
   npm run deploy:functions
   ```
3. **Desktop Auto-Update Emergency Revocation:**
   - Immediately remove or revert the `latest-mac.yml` / `latest.yml` release manifest from GitHub Releases to prevent desktop clients from downloading the defective build.
