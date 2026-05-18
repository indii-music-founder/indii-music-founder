# Deployment Guide

## Overview

This project has **two separate deployments**:

1. **Landing Page** - React + Vite static site with WebGL effects
   - URL: <https://YOUR_FIREBASE_PROJECT_ID.web.app>
   - Source: `landing-page/`
   - Build output: `landing-page/dist/`

2. **Studio App** - React + Vite main application
   - URL: <https://YOUR_FIREBASE_STUDIO_APP_ID.web.app>
   - Source: `src/`
   - Build output: `dist/`

## Local Development

### Landing Page

```bash
cd landing-page
npm install
npm run dev
```

### Studio App

```bash
npm install
npm run dev
```

## Building for Production

### Build Both Sites

```bash
npm run build:all
```

### Build Landing Page Only

```bash
npm run build:landing
```

### Build Studio App Only

```bash
npm run build:studio
```

## Manual Deployment to Firebase

### Prerequisites

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Select project: `firebase use YOUR_FIREBASE_PROJECT_ID`

### Deploy Both Sites

```bash
# Build both sites
npm run build:all

# Deploy landing page
firebase deploy --only hosting:landing

# Deploy studio app
firebase deploy --only hosting:app

# Or deploy both at once
firebase deploy --only hosting
```

## Automated Deployment (CI/CD)

The project uses GitHub Actions for automated deployments on merge to `main`.

### Workflow: `.github/workflows/deploy.yml`

- Triggers on push to `main` or manual workflow dispatch
- Builds both landing page and studio app
- Deploys to Firebase Hosting using service account

### Required GitHub Secrets

- `FIREBASE_SERVICE_ACCOUNT` - Service account JSON for Firebase deployment
- `VITE_API_KEY` - API key for the studio app (optional)
- `VITE_VERTEX_PROJECT_ID` - GCP project ID (optional)
- `VITE_VERTEX_LOCATION` - GCP location (optional)

## Troubleshooting

### Landing page and studio showing the same content

This happens when `landing-page/dist` doesn't exist. Build the landing page first:

```bash
npm run build:landing
```

### Build fails

1. Clear node_modules and reinstall:

   ```bash
   rm -rf node_modules landing-page/node_modules
   npm install
   cd landing-page && npm install
   ```

2. Check Node.js version (requires 22.x):

   ```bash
   node --version
   ```

### Deployment fails

1. Verify Firebase targets are configured:

   ```bash
   firebase target:list
   ```

2. Set targets if missing:

   ```bash
   firebase target:apply hosting landing YOUR_FIREBASE_PROJECT_ID
   firebase target:apply hosting app YOUR_FIREBASE_STUDIO_APP_ID
   ```

### Build fails with "missing @esbuild/linux-x64"

This occurs when building on Linux (CI) but the lockfile was generated on macOS.

**Fix:** explicitly add the binary to optional dependencies:

```json
"optionalDependencies": {
  "@esbuild/linux-x64": "0.25.12"
}
```

Ensure the version matches your root `esbuild` version.

## Architecture

```
Rndr-AI-v1/
├── landing-page/          # React + Vite landing site
│   ├── src/              # Source code
│   ├── package.json      # Landing page dependencies
│   └── dist/             # Build output (gitignored)
├── src/                  # Studio app source
├── dist/                 # Studio build output (gitignored)
├── firebase.json         # Firebase hosting config
└── .firebaserc          # Firebase project config
```

## Firebase Hosting Configuration

### `.firebaserc`

```json
{
  "targets": {
    "YOUR_FIREBASE_PROJECT_ID": {
      "hosting": {
        "landing": ["YOUR_FIREBASE_PROJECT_ID"],
        "app": ["YOUR_FIREBASE_STUDIO_APP_ID"]
      }
    }
  }
}
```

### `firebase.json`

```json
{
  "hosting": [
    {
      "target": "landing",
      "public": "landing-page/dist"
    },
    {
      "target": "app",
      "public": "dist"
    }
  ]
}
```

## Verification

After deployment, verify both sites are working:

1. **Landing Page**: <https://YOUR_FIREBASE_PROJECT_ID.web.app>
   - Should show WebGL effects and animation
   - Should have "Enter Studio" or similar CTA

2. **Studio App**: <https://YOUR_FIREBASE_STUDIO_APP_ID.web.app>
   - Should show the main indiiOS studio interface
   - Should load authentication and workspace features
