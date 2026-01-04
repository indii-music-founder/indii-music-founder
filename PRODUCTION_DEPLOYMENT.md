# Production Deployment Guide - indiiOS Alpha

## Overview

This guide covers production deployment for indiiOS Electron application and Firebase Hosting targets.

## Prerequisites

### Environment Setup

1. Ensure Node.js v22 or higher is installed
2. Install Firebase CLI: `npm install -g firebase-tools`
3. Configure Firebase: `firebase login`

### Required Environment Variables

```bash
# Local Development (.env)
VITE_GEMINI_API_KEY=<your-gemini-api-key>
VITE_FIREBASE_CONFIG=<json-config-string>
VITE_VERTEX_PROJECT_ID=<gcp-project-id>
VITE_VERTEX_LOCATION=<vertex-location>
VITE_FCM_VAPID_KEY=<vapid-key>

# Firebase Functions (functions/.env)
GEMINI_API_KEY=<same-gemini-key>
VERTEX_PROJECT_ID=<same-project-id>
INNGEST_EVENT_KEY=<inngest-event-key>
```

## Deployment Steps

### Phase 1: Testing and Validation

```bash
# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Typecheck
npx tsc --noEmit

# Lint
npm run lint:fix
```

### Phase 2: Build Production Artifacts

```bash
# Build all targets
npm run build:all

# Build landing page only
cd landing-page && npm run build

# Build studio app only
npm run build:studio
```

### Phase 3: Firebase Hosting Deployment

```bash
# Deploy all hosting targets
firebase deploy --only hosting

# Deploy specific target
firebase deploy --only hosting:indiios-studio

# Deploy with functions
firebase deploy --only functions,hosting
```

### Phase 4: Electron App Distribution

#### macOS

```bash
# Build for macOS
npm run electron:build

# The output will be in: dist/mac/
```

**Code Signing for macOS (REQUIRED for distribution):**

1. Get a Developer ID from Apple Developer Portal
2. Install signing certificate in Keychain
3. Update `electron-builder.json`:
   ```json
   {
     "mac": {
       "identity": "Developer ID Application: Your Name (TEAM_ID)",
       "hardenedRuntime": true
     }
   }
   ```

#### Windows

```bash
# Build for Windows
npm run electron:build --win

# Output in: dist/win/
```

**Code Signing for Windows:**

1. Get a code signing certificate from a CA (e.g., DigiCert)
2. Install certificate in Windows Certificate Store
3. Update `electron-builder.json`:
   ```json
   {
     "win": {
       "certificateFile": "path/to/certificate.pfx",
       "certificatePassword": "password"
     }
   }
   ```

#### Linux

```bash
# Build for Linux
npm run electron:build --linux

# Output in: dist/linux/
```

**AppImage (recommended):**

```bash
# The AppImage will be in dist/
# Users can run without installation
```

## CI/CD Pipeline

### GitHub Actions Workflow

The `.github/workflows/deploy.yml` handles automatic deployments on push to `main`.

**Workflow Steps:**

1. Checkout repository
2. Setup Node.js v20.x
3. Install dependencies
4. Run tests
5. Build production assets
6. Deploy to Firebase Hosting

### Manual Deployment Triggers

```bash
# Trigger deployment manually
gh workflow run deploy.yml
```

## Security Checklist

Before deploying to production:

- [ ] Remove all hardcoded secrets and API keys
- [ ] Verify environment variable enforcement in `src/config/env.ts`
- [ ] Confirm Firestore security rules are deployed
- [ ] Confirm Storage security rules are deployed
- [ ] Enable Content Security Policy headers
- [ ] Sign Electron executables
- [ ] Verify Electron sandbox is enabled
- [ ] Context isolation is active
- [ ] No Node integration in renderer processes

## Monitoring and Observability

### Firebase Console

1. Functions logs: Monitor for errors and cold starts
2. Firestore queries: Check for slow queries
3. Storage traffic: Monitor bandwidth usage
4. Crashlytics: Set up crash reporting

### Sentry (Optional)

```bash
# Install Sentry SDK
npm install @sentry/react
```

Configure in `src/main.tsx`:

```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: "production",
});
```

## Rollback Procedures

### Quick Rollback (Hosting)

```bash
# Rollback hosting to previous version
firebase hosting:rollback

# Or redeploy specific release ID
firebase deploy --only hosting:indiios-studio --version <version-id>
```

### Functions Rollback

```bash
# Delete a specific function version
firebase functions:delete <function-name> --region <region>

# Redeploy previous version
git checkout <previous-commit>
firebase deploy --only functions
```

## Troubleshooting

### Build Failures

**Node version mismatch:**

```bash
# Update Node.js to v22
nvm install 22
nvm use 22
npm install
```

**Native module build failures:**

```bash
# Rebuild native modules
npm run rebuild
```

### Deployment Errors

**Firebase authentication:**

```bash
firebase login:ci
firebase deploy --only hosting --token <token>
```

**Function deployment timeout:**

- Increase timeout in `firebase.json`:
  ```json
  {
    "functions": [
      {
        "source": "functions",
        "codebase": "default",
        "ignore": ["node_modules", ".git", "firebase-debug.log"]
      }
    ]
  }
  ```

### Electron App Won't Start

**Code signing issues (macOS):**

```bash
# Verify certificate in Keychain
security find-identity -v -p codesigning

# Manually re-sign
codesign --force --deep --sign "Developer ID Application" YourApp.app
```

**Missing dependencies:**

```bash
# Rebuild all native dependencies
npm run rebuild
```

## Performance Optimization

### Bundle Size Monitoring

```bash
# Analyze bundle size
npm run build -- --report

# Check dist/index.html for bundle references
```

### Firebase Cold Starts

Use these strategies to reduce cold start latency:

1. Enable Gen 2 functions (already configured)
2. Increase minimum instances for critical functions (cost tradeoff):
   ```javascript
   export const myFunction = onCall(
     {
       region: "us-central1",
       minInstances: 1,
     },
     async (request) => {
       // ...
     },
   );
   ```

## Support and Resources

- Firebase Documentation: https://firebase.google.com/docs
- Electron Builder: https://www.electron.build
- Sentry Documentation: https://docs.sentry.io
- indiiOS Internal Docs: `docs/` directory

## Known Issues and Workarounds

### Issue: Electron build fails on paths with spaces (Mac)

Workaround: Build in a path without spaces or use `Forge`:

```bash
# Move to path without spaces
cp -R /path/to/project /tmp/indiiOS
cd /tmp/indiiOS
npm run electron:build
```

### Issue: Pre-commit hooks not running

Reinstall hooks:

```bash
npx husky install
```

## Next Steps

After production deployment:

1. Set up monitoring dashboards
2. Configure alerting for critical errors
3. Document any production-specific configurations
4. Schedule regular dependency audits
5. Plan for disaster recovery procedures

---

**Last Updated:** 2025-12-27
**Version:** 0.1.0-beta.2
