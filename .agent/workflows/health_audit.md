---
description: Daily health check workflow - validates integration tests, Sentry metrics, and updates dashboard
---

# /health_audit - Daily Health Check (Planned)

**See:** `.agent/TESTING_INTEGRATION_GUIDE.md` for full integration system context.

This workflow is **planned** and not yet implemented. It will automate:

1. Run integration tests daily (`npm run health:check`)
2. Fetch latest Sentry metrics
3. Generate health dashboard (`npm run health:generate-dashboard`)
4. Alert on failures (create GitHub Issues)
5. Update metrics in Firestore

## Implementation Plan

Once this workflow is built:
- Run scheduled daily via GitHub Actions or Cloud Scheduler
- Execute integration test subset for speed
- Log results to Sentry + Firestore
- Auto-create GitHub Issues on health check failures
- Update health dashboard with latest metrics

## For Now

Teams can manually run health checks using:
```bash
npm run health:check
npm run health:generate-dashboard
```

See `.claude/plans/encapsulated-riding-spark.md` for the full testing system vision.
