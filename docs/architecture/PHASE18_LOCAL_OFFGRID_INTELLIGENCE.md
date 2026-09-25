# Phase 18 — Local/off-grid intelligence

## Delivered vertical slices

The existing Distribution QC intake now offers an explicit local-only technical
audio scan alongside its existing connected analysis. It accepts only an
in-memory `File`/`Blob`, computes a content fingerprint and technical estimates
with the existing Web Audio analyzer, and displays the result in the QC panel.

The same local-only route reads a bounded set of embedded WAV RIFF/INFO and
FLAC Vorbis-comment fields (title, artist, album, and ISRC) from the selected
bytes. Malformed or out-of-container data is ignored. These values display as
`DETECTED`, unconfirmed evidence; they are not copied into release metadata,
canonical identity, agent context, or any saved record.

The local-only path does not read or write the analysis cache, invoke Electron
IPC, upload bytes, call AI or other network services, populate semantic tags,
or save a result for agents. Its `DETECTED` provenance and UI copy distinguish
measured/estimated audio properties and embedded file tags from identity,
rights, registration, or clearance facts. The existing connected path and its
default behavior remain unchanged. This is not a general offline guarantee for
other app features.

## Downstream consumer

Distribution QC can consume technical measurements and embedded tags for a
local preflight display while offline. The reports remain in component memory
and are not promoted to canonical catalog truth or made available to
autonomous agents.

The existing onboarding PDF extraction now returns a `DETECTED` provenance
receipt and carries it with the extracted text into the existing conversation
request. PDF parsing receives the selected file bytes locally and invokes no
AI service; the app-shipped PDF worker can load from the application origin.
Only when the user later submits the onboarding conversation is its extracted
text sent to the connected model, accompanied by an explicit unverified-source
note. This is a local parsing step, not an offline onboarding guarantee.

The existing main-process `MediaOps.probeMedia` remains the deterministic
local video/container measurement provider for duration, dimensions, frame
rate, codecs, and audio/video stream presence. The Electron render service
consumes that probe for output verification; this delivery adds no second video
pipeline and does not claim semantic scene analysis.

## Verification and rollback

Service, UI, and onboarding tests cover WAV/FLAC fixtures,
malformed/container-bounded tags, `DETECTED` provenance, no external service
call during parsing, no release-form auto-fill, no cache or persistence, and
the explicit provenance carried into the later connected conversation. To roll
back these slices, remove the local-only selection and its service entry
points; the existing connected analysis and onboarding behavior remains
available.

## Remaining Phase 18 scope

This delivery does not make the application generally usable offline and does
not claim Phase 18 is fully complete. Scanned-document OCR currently downloads
its language data from a CDN. The local-first model preference is stored
remotely, and no end-to-end local reasoning provider is currently wired through
all consumers. Local video rendering and deterministic FFprobe measurements
exist, but this slice adds no semantic video-analysis provider. Workflow and computer-control actions remain subject
to their existing remote-service and explicit AOP authorization requirements.
Those areas need independent, tested provider wiring and explicit
offline/privacy behavior before they can be represented as delivered.
