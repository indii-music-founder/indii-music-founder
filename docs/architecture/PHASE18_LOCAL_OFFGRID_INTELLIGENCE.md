# Phase 18 — Local/off-grid intelligence

## Delivered vertical slice

The existing Distribution QC intake now offers an explicit local-only technical
audio scan alongside its existing connected analysis. It accepts only an
in-memory `File`/`Blob`, computes a content fingerprint and technical estimates
with the existing Web Audio analyzer, and displays the result in the QC panel.

The local-only path does not read or write the analysis cache, invoke Electron
IPC, upload bytes, call AI or other network services, populate semantic tags,
or save a result for agents. Its `DETECTED` provenance and UI copy distinguish
measured/estimated audio properties from identity, rights, registration, or
clearance facts. The existing connected path and its default behavior remain
unchanged. This is not a general offline guarantee for other app features.

## Downstream consumer

Distribution QC can consume the technical measurements for a local preflight
display while offline. The report remains in component memory and is not
promoted to canonical catalog truth or made available to autonomous agents.

## Verification and rollback

The audio service test validates the provenance contract and proves the local
route does not use fetch, cache reads, or persistence. To roll back this slice,
remove the local-only selection and its service entry point; the existing
connected analysis path is unchanged.

## Deliberate boundaries

This slice does not yet move semantic musicology, document analysis, video
analysis, local reasoning, or workflow execution to on-device providers. Those
remain separate provider and security work; no claim is made that the whole
application is available offline.
