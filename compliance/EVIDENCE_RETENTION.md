# SOC 2 Evidence Retention

**Status:** Active readiness requirement  
**As of:** 2026-09-26

## Purpose

indii.music is intentionally collecting compliance evidence during normal development so future SOC 2 work can use contemporaneous records instead of reconstructed history.

## Current automated evidence

The scheduled GitHub workflow creates timestamped evidence containing:

- execution time;
- exact git SHA;
- control-registry validation result;
- frontend secret/API-boundary result;
- Vertex/backend-routing result;
- a copy of the current control registry.

GitHub Actions artifacts are currently retained for **90 days**.

## Gap

A Type II examination observes control operation over a period. A 90-day expiring artifact store can lose early-period evidence before a longer observation window ends.

Therefore GitHub Actions artifacts are the **hot store**, not the long-term system of record.

## Durable-retention requirement

Before beginning a formal observation period:

1. choose an access-controlled durable evidence store;
2. retain evidence for at least the full observation period plus audit completion and an internal buffer;
3. preserve original timestamps, git SHAs, workflow/run identifiers, checksums, and control-registry version;
4. prevent silent overwrite of historical evidence;
5. log evidence export failures;
6. define who can read, write, delete, and change retention;
7. document the evidence store in the vendor/risk/control registries;
8. test retrieval of old evidence before an auditor needs it.

## Preferred design

Use immutable or versioned object storage with lifecycle policy and restricted service-account writes.

The CI collector should write one evidence bundle per run under a deterministic path such as:

```text
soc2/<year>/<month>/<day>/<git-sha>/<workflow-run-id>/
```

A small manifest should include hashes for every object in the bundle.

Do not put customer content, credentials, transcripts, payment data, or unnecessary PII into compliance evidence.

## Current claim language

Safe:

> indii.music has implemented continuous SOC 2 readiness controls and automated evidence collection, with a documented requirement for durable retention before a formal Type II observation period.

Not safe:

> indii.music is SOC 2 certified.

Not safe:

> The current 90-day GitHub artifact archive is sufficient for any future SOC 2 audit.

## Completion gate

This retention gap is closed only when:

- a durable store is configured;
- automated export succeeds;
- access controls are tested;
- retention is documented;
- an older evidence bundle is successfully restored and verified.
