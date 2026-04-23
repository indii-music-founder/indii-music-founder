# indiiOS — Tech Stack

> **Verified against** root `package.json`, `packages/*/package.json`, `electron.vite.config.ts`, `firebase.json`, `tsconfig.json`, and `.github/workflows/deploy.yml` at v1.55.3.

## Monorepo

- **Root:** `indiios-monorepo` v1.55.3
- **Type:** ES module
- **Node engine:** `>=22.0.0`
- **Workspaces (6 packages):**

| Package | Purpose | Runtime |
|---|---|---|
| `packages/main` | Electron main process, IPC, ffmpeg / ffprobe, keytar, SFTP, WebSocket, ngrok tunnel | Node 22 (CJS) |
| `packages/renderer` | React 18 UI, Tailwind, Zustand, Remotion, Three.js, Yjs CRDT — the bulk of the app | ESM / Vite |
| `packages/firebase` | Cloud Functions, Firestore rules, BigQuery, Vertex AI, Stripe, Inngest, Genkit | Node 22 Gen 2 |
| `packages/shared` | Zod schemas and cross-workspace types (type-only, no runtime) | ESM |
| `packages/landing` | Marketing site (separate React + Vite app) | ESM / Vite |
| `packages/mcp-server-local` | Model Context Protocol server | Node |

## Languages and compilation

| Tool | Version | Notes |
|---|---|---|
| TypeScript | 5.8.2 | strict, ES2022 target, bundler module resolution, JSX `react-jsx` |
| Vite | 6.4.1 (renderer), 6.2.0 (landing) | Tailwind CSS plugin, chunk size warning 1000 KB |
| electron-vite | 5.0.0 | Orchestrates main / preload / renderer builds |
| esbuild | 0.25.12 | |
| Lightning CSS | 1.30.2 | |

### Path aliases (tsconfig.json)

- `@/*` → `packages/renderer/src/*`
- `@shared/*` → `packages/shared/src/*`
- `@agents/*` → `agents/*`

## Frontend (packages/renderer)

| Category | Library | Version |
|---|---|---|
| Framework | React + ReactDOM | 18.3.1 |
| Router | React Router DOM | 7.14.0 |
| State | Zustand | 5.0.8 (primary, 23 slices) |
| State (legacy) | Redux Toolkit + React-Redux | 2.11.2 / 9.2.0 |
| Styling | TailwindCSS | 4.1.17 (via `@tailwindcss/vite`) |
| Utilities | clsx, classnames, tailwind-merge | 2.1.1 / 2.5.1 / 3.4.0 |
| UI primitives | Radix UI | dialog, dropdown, tooltip, progress, context-menu |
| Icons | lucide-react | 0.555.0 |
| Animation | Framer Motion | 12.35.1 |
| Canvas | Fabric.js | 7.2.0 |
| 3D | Three.js + @react-three/fiber + @react-three/drei | 0.182.0 / 8.18.0 / 9.122.0 |
| Video | Remotion (core, cloudrun, renderer, bundler, player) | 4.0.445 |
| Audio waveform | wavesurfer.js | 7.11.1 |
| Audio analysis | essentia.js | 0.1.3 |
| OCR | tesseract.js | 6.0.1 |
| PDF | pdfjs-dist | 5.4.449 |
| Charts | Recharts | 3.6.0 |
| Graph editor | React Flow | 11.11.4 |
| Realtime CRDT | yjs + y-websocket + y-protocols | 13.6.29 / 3.0.0 / 1.0.7 |
| Validation | Zod | 3.25.76 (pinned via overrides) |
| JSON Schema | Ajv | 8.18.0 |
| Sanitization | DOMPurify | 3.3.3 |
| Dates | date-fns | 4.1.0 |
| IDs | uuid | 13.0.0 |
| Crypto | crypto-js | 4.2.0 |
| Observability | @sentry/react | 10.32.1 |
| i18n | i18next + react-i18next | 25.8.14 / 16.5.6 |
| Offline cache | idb | 7.1.1 |
| QR codes | qrcode.react | 4.2.0 |

## AI and LLM layer

| Layer | Library | Version |
|---|---|---|
| Gemini JS client (renderer + functions) | @google/genai | 1.48.0+ |
| Vertex AI (functions) | @google-cloud/vertexai | 1.10.0 |
| Genkit AI framework | @genkit-ai/firebase + @genkit-ai/google-cloud | 1.26.0 (pinned) |
| Provider-agnostic adapter | @ai-sdk/google | 3.0.60 |
| Workflow agents | Mastra | 1.24.1 / 1.4.2 |
| Serverless workflow jobs | Inngest | 3.46.0 (renderer) / 3.22.12 (functions) |
| Agent gateway (future) | Gemini Enterprise Agent Platform (GEAP) | Phase 1 complete — see `docs/GEMINI_ENTERPRISE_AGENT_PLATFORM.md` |

## Python sidecar

- **Service:** `indii-agent` (Docker Compose)
- **Ports:** 50080 (HTTP API), 8880 (UI proxy)
- **Working dir:** `/a0`
- **Protocol:** HTTP REST; renderer-side bridge via `MCPClientService`; main-process spawn via `python-bridge.ts`
- **MCP SDK:** `@modelcontextprotocol/sdk` 1.25.2+
- **Tools:** 92 custom tools under `python/tools/` — audio forensics, image / video generation, legal drafters, DDEX utilities, campaign generators, browser automation

## Electron desktop (packages/main)

| Component | Version | Purpose |
|---|---|---|
| Electron | 41.1.1 | Chromium + Node.js runtime |
| Electron Forge | 7.8 | Packaging |
| Electron Builder | 26.8.1 | DMG / NSIS / AppImage distribution |
| electron-log | 5.4.3 | IPC + main-process logging |
| electron-store | 11.0.2 | Persistent config |
| keytar | 7.9.0 | OS keychain (distributor credentials, OAuth tokens, SFTP keys) |
| ssh2-sftp-client | 12.0.1 | SFTP delivery to distributors |
| ffmpeg-static + ffprobe-static + fluent-ffmpeg | 5.3.0 / 3.1.0 / 2.1.3 | Audio / video processing |
| chokidar | 5.0.0 | File watching |
| express | 4.22.1 | Local HTTP server |
| ws | 8.18.0 | WebSocket |
| @ngrok/ngrok | 1.7.0 | Tunnel |

**Security posture:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `setContentProtection(true)` to prevent screen capture of sensitive views.

## Backend (packages/firebase)

| Library | Version |
|---|---|
| firebase-admin | 13.7.0 |
| firebase-functions | 7.0.5 |
| @google-cloud/bigquery | 8.1.1 |
| @google-cloud/vertexai | 1.10.0 |
| @google-cloud/video-transcoder | 4.4.1 |
| @google/genai | 1.48.0+ |
| googleapis | 170.0.0 |
| inngest | 3.22.12 |
| stripe | 20.1.2 |
| sharp | 0.34.5 |
| express | 4.19.2 |
| resend | 6.11.0 |
| zod | 3.25.76 |

## Database and storage

- **Firestore** — custom-claims auth, organization membership model, soft-delete on long-lived docs
- **Firebase Storage** — bucket `indiios-alpha-electron`, rules enforce auth + org membership + size / content-type limits
- **Firestore Emulator** — `localhost:8080`, single-project mode for local dev
- **BigQuery** — revenue analytics warehouse

## Hosting

- **Firebase Hosting — landing target** → `packages/landing/dist`
- **Firebase Hosting — app target** → `dist/renderer`
- **Firebase Functions** — Node 22 Gen 2

## Testing

| Tool | Version | Use |
|---|---|---|
| Vitest | 4.0.18 | Unit tests (jsdom), 4-way shard in CI, coverage via v8 |
| @vitest/ui | 4.0.18 | Interactive runner |
| Testing Library (react + dom + jest-dom) | 16.3.0 / 10.4.1 / 6.9.1 | Component tests |
| Playwright | 1.58.2 | E2E tests, chromium only, 1 worker, `e2e/` dir |
| @axe-core/playwright + jest-axe + vitest-axe | 4.11.1 / 10.0.0 / 0.1.0 | Accessibility |
| MSW | 2.12.14 | HTTP mocks |
| fake-indexeddb | 6.2.5 | Offline store mocks |
| **Google Antigravity** | n/a (external) | **Live browser testing during pre-demo QA** — not in CI, used interactively |
| @firebase/rules-unit-testing | 5.0.0 | Firestore rules tests |

**Test inventory:** 1,196 files (`*.test.ts`, `*.test.tsx`, `*.spec.ts`) across packages/ and e2e/.

## CI / CD

**GitHub Actions** — `.github/workflows/deploy.yml`:

1. Secret scan (gitleaks-action)
2. npm audit (high severity gate)
3. Lint + typecheck
4. Vitest — 4-way shard parallel, 15 min timeout
5. Playwright (chromium)
6. Build landing + app
7. Firebase deploy (hosting + functions)
8. Electron Builder matrix (mac / win / linux)

**Triggers:** push to `main` or manual dispatch.

**Supporting workflows:**
- `autoagent-nightly.yml` — scheduled agent runs
- `release.yml` + `release-please.yml` — conventional-commit automation
- `build.yml` — build matrix

## Development commands

| Command | What it does |
|---|---|
| `npm run dev` | Full Electron dev via `electron-vite dev` |
| `npm run dev:web` | Web-only renderer on `localhost:4243` |
| `npm run build` | `electron-vite build` |
| `npm run build:ci` | typecheck + lint + full build |
| `npm run build:desktop` | Build + electron-builder (no publish) |
| `npm run deploy` | Build + `firebase deploy --only hosting:app` |
| `npm run deploy:functions` | Build functions workspace + deploy |
| `npm run deploy:all` | Full stack deploy (hosting + functions) |
| `npm test` | Vitest watch mode |
| `npm run test:e2e` | Playwright chromium |
| `npm run test:rules` | Firestore rules tests against emulator |
| `npm run typecheck` | `tsc -b packages/shared packages/main packages/renderer` |
| `npm run lint` | `eslint packages/*/src --ext .ts,.tsx` |

## Environment variables

Critical `VITE_` vars (see `.env.example`):

- **Firebase:** `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FCM_VAPID_KEY`, `VITE_FIREBASE_APP_CHECK_KEY`
- **Google AI / Vertex:** `VITE_API_KEY`, `VITE_VERTEX_PROJECT_ID`, `VITE_VERTEX_LOCATION`, `VITE_USE_VERTEX`
- **Backend services:** `VITE_FUNCTIONS_URL`, `VITE_RAG_PROXY_URL`, `VITE_API_BASE_URL`, `VITE_USE_FUNCTIONS_EMULATOR`
- **Feature flags:** `VITE_SKIP_ONBOARDING`, `VITE_USE_MOCK_API`, `VITE_USE_REMOTE_STORAGE`, `VITE_USE_FINE_TUNED_AGENTS`
- **Integrations:** `VITE_STRIPE_*`, `VITE_PRINTFUL_API_KEY`, `VITE_ALCHEMY_API_KEY`, `VITE_WALLETCONNECT_*`, `VITE_DOCUSIGN_*`, `VITE_NOTARIZE_API_KEY`, `VITE_SPOTIFY_CLIENT_ID`, `VITE_APPLE_MUSIC_DEV_TOKEN`, `VITE_TIKTOK_CLIENT_KEY`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_OAUTH_CLIENT_ID`
- **Distribution:** `VITE_DDEX_DPID_*`, `VITE_REMOTION_*`
- **Python sidecar:** `VITE_A0_AUTH_LOGIN`, `VITE_A0_AUTH_PASSWORD`, `VITE_A0_BASE_URL`, `VITE_A0_RUNTIME_ID`
- **Observability:** `VITE_SENTRY_DSN`, `VITE_DEBUG_SENTRY`
- **Realtime:** `VITE_WEBSOCKET_URL`

## Payment and billing

- Stripe 20.1.2 in both renderer (client) and functions (server)
- Founders checkout at `packages/renderer/src/modules/founders/`
- Subscription management in `packages/firebase/src/subscription/`

## Key dependency overrides (root `package.json`)

- `zod` pinned to 3.25.76
- `@genkit-ai/firebase` + `@genkit-ai/google-cloud` pinned to 1.26.0
- `fast-xml-parser` pinned to 5.5.10 (DDEX XML parsing)
