# Implementation Plan: System Variables & API Dependencies

## Third-Party API Dependencies Discovered
1. **Google Cloud / Firebase Blaze:** Requires `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`. Target Setup: Must enable Blaze plan for Cloud Functions and configure new Firebase Project.
2. **Google OAuth / Vertex AI:** Requires `VITE_VERTEX_PROJECT_ID`, `GOOGLE_OAUTH_CLIENT_ID`. Target Setup: OAuth Consent screen requires new branding and founder support email.
3. **Sentry (Error Monitoring):** Requires `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`. Setup complete via `indiimusic-im` org.
4. **Stripe (Payments):** Requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Target Setup: New webhook endpoints must be registered under standalone domain.
5. **SendGrid / Mailchimp (Email):** Requires `SENDGRID_API_KEY`, `MAILCHIMP_API_KEY`.
6. **DDEX / SFTP Distribution:** Requires SFTP keys and provider IDs.

## Required Environment Variables for Clean System (Python / Global)

### Core System
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `GCP_PROJECT_ID`

### Intelligence / AI APIs
- `GEMINI_API_KEY`
- `VERTEX_LOCATION`

### Integrations
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SENDGRID_API_KEY`
- `SENTRY_DSN`

## Operational Replacement Strategy
1. **Hardcoded Strings:** All legacy hardcoded strings (e.g., `indiios-v-1-1`) have been purged and replaced with generic `YOUR_FIREBASE_PROJECT_ID` fallbacks.
2. **Environment Ingestion:** Python runtime must ingest via `os.environ.get()` referencing the `.env` ecosystem.
3. **CI/CD Injectors:** GitHub actions will rely on repository secrets (`SENTRY_AUTH_TOKEN`, `FIREBASE_CLI_TOKEN`) to inject values during build/deploy securely without exposing them in code.
