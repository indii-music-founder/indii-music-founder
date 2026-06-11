# indii Admin Dashboard

A standalone admin console for indii. Shows **real data only** — per-user AI token
usage / cost and the live founders roster. No mock or placeholder data: empty states
show real zeros until real activity exists.

## Architecture

- **Frontend** — Vite + React (`src/`). Auth-gated; only `@indii.music` accounts get in.
- **Backend** — Express (`server.ts`) using `firebase-admin` to read Firestore.
- The Vite dev server proxies `/api` → the Express backend (default `:3333`).

## Modules (real data)

| Module | Source |
|--------|--------|
| **Token Usage** | `user_usage_stats` Firestore collection (written by `TokenUsageService.trackUsage`). Cost by model, spend by user, projected economics. |
| **Founders Portal** | `founders` Firestore collection (written by `activateFounderPass`). Live seat count (X of 11) + roster. |

Mock-only modules (Email Manager, DDEX Tracker, Nexus Monitor) are intentionally
hidden until wired to real sources.

## Running it locally

1. **Authenticate to Google** so the backend can read Firestore — pick one:
   ```bash
   gcloud auth application-default login          # easiest
   # or
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   ```

2. **Start both backend + frontend** (one command):
   ```bash
   npm run dev:all
   ```
   Or run them separately: `npm run server` (Express on :3333) and `npm run dev` (Vite).

3. Open the Vite URL printed in the terminal. Enter your `@indii.music` email and
   we'll email you a sign-in link. **Click the link in the email** — no password needed.

### Verify the backend can see data
```bash
curl http://localhost:3333/api/health
# { "status": "ok", "firestore": "connected" }   ← good
# { "status": "degraded", "firestore": "unreachable", "hint": ... }  ← fix credentials
```

## Auth & security

- The backend gates every data route on a Firebase ID token whose email ends in
  `@indii.music` (`requireAdminAuth`).
- The frontend signs in via Firebase, stores a fresh ID token in `localStorage`
  (`indii_admin_token`), and sends it as a Bearer token.
- Firebase web config values are public identifiers; real authorization is enforced
  server-side and by Firestore Security Rules.

## Scripts

| Script | Does |
|--------|------|
| `npm run dev:all` | Backend + frontend together |
| `npm run server` | Express backend only (`tsx watch`) |
| `npm run dev` | Vite frontend only |
| `npm run build` | Typecheck + production build |
| `npm run lint` | ESLint |
