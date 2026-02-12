# Deployment Rollback Strategy

> **indiiOS-Alpha-Electron** — How to roll back deployments when things go wrong

---

## Overview

indiiOS deploys to three targets. Each has its own rollback mechanism.

| Target          | Platform                     | Rollback Method           |
| --------------- | ---------------------------- | ------------------------- |
| Studio Web App  | Firebase Hosting (`app`)     | Version revert            |
| Landing Page    | Firebase Hosting (`landing`) | Version revert            |
| Cloud Functions | Firebase Functions (Gen 2)   | Redeploy previous version |

---

## Firebase Hosting Rollback

Firebase Hosting keeps a history of every deployment. Rollback is instant.

### Via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com) → Hosting
2. Click **Release history**
3. Find the last working release
4. Click the **⋮** menu → **Rollback to this release**

### Via CLI

```bash
# List recent releases
firebase hosting:channel:list

# Rollback to a specific version (get version ID from console)
firebase hosting:clone <site>:<version> <site>:live
```

**Recovery time:** < 1 minute (CDN cache invalidation)

---

## Cloud Functions Rollback

Firebase Functions (Gen 2) run on Cloud Run. Each deploy creates a new revision.

### Quick Rollback via GCP Console

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Select the function (e.g., `triggerVideoJob`)
3. Click **Revisions** tab
4. Select the previous healthy revision
5. Click **Manage Traffic** → Route 100% to the old revision

### Via CLI

```bash
# List revisions for a function
gcloud run revisions list --service=triggerVideoJob --region=us-central1

# Route traffic to a specific revision
gcloud run services update-traffic triggerVideoJob \
  --region=us-central1 \
  --to-revisions=triggerVideoJob-00042-abc=100
```

### Redeploy Previous Code

```bash
# Checkout the last known good commit
git checkout <last-good-commit>

# Redeploy functions only
cd functions && npm run build
firebase deploy --only functions
```

**Recovery time:** 1-3 minutes

---

## Electron Desktop Rollback

Desktop app updates are distributed via installers. Rollback requires users to reinstall.

### Mitigation Strategies

1. **Staged rollout:** Distribute beta builds to test group before GA
2. **Version pinning:** Keep previous release artifacts in GitHub Releases
3. **Feature flags:** Use `FeatureFlagService` (Firebase Remote Config) to disable broken features without redeployment

---

## Emergency Procedures

### Immediate Mitigation (< 1 min)

| Scenario               | Action                                       |
| ---------------------- | -------------------------------------------- |
| Broken UI/JS           | Firebase Hosting rollback                    |
| Broken API/Functions   | Cloud Run traffic shift                      |
| Security vulnerability | Enable `maintenance_mode` feature flag       |
| Data corruption        | Pause writes via security rules, investigate |

### Maintenance Mode

Toggle maintenance mode without redeployment:

1. Go to Firebase Console → Remote Config
2. Set `maintenance_mode` = `true`
3. Publish changes

The app checks this flag via `FeatureFlagService` and can show a maintenance screen.

---

## Prevention

1. **CI/CD gates:** All quality gates (typecheck, lint, tests) must pass before deploy
2. **Preview channels:** Use `firebase hosting:channel:deploy preview` for pre-prod testing
3. **Canary deploys:** Route 5% traffic to new revision before full rollout (Cloud Run traffic splitting)
4. **Health checks:** Monitor `/healthCheck` endpoint after every deploy
5. **Alerts:** Set up uptime monitoring on the health check endpoint

---

## Runbook

### Post-Deploy Verification

```bash
# 1. Check health endpoint
curl -s https://us-central1-indiios-v-1-1.cloudfunctions.net/healthCheck | jq .

# 2. Verify hosting is serving (check HTTP 200)
curl -s -o /dev/null -w "%{http_code}" https://indiios-v-1-1.web.app/

# 3. Check function logs for errors
firebase functions:log --only triggerVideoJob --limit 20
```

### Decision Matrix

| Severity | Symptoms             | Action                                |
| -------- | -------------------- | ------------------------------------- |
| P0       | App won't load       | Hosting rollback immediately          |
| P0       | Auth broken          | Functions rollback + hosting rollback |
| P1       | Feature broken       | Feature flag disable                  |
| P2       | Performance degraded | Monitor, schedule fix                 |
| P3       | Visual bug           | Schedule fix, no rollback             |
