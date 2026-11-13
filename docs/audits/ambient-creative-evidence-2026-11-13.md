# Ambient creative evidence contracts — 2026-11-13

Base: origin/main 981d02397. Branch: codex/ambient-creative-evidence-20261113.

## Reproduced evidence gaps

Creative mode, gallery prompt-to-brand scoring and campaign format selection
replaced absent/invalid provider confidence with numeric heuristic confidence.
Their deterministic fallbacks also invented confidence values. The mode banner
called this a match percentage, and campaign tags called it percent fit. Gallery
badges described asset fit even though only prompt text and brand context were
submitted. Campaign slots zero through two were automatically awarded Top Pick
before any output comparison. Prompt words such as glitch were interpreted as
rendered defects and recommended retry despite no output inspection.

## Implemented changes

All three verdicts now distinguish source=heuristic with null confidence from an
adopted typed provider result with source=jev and actual bounded confidence.
Mode adopts Choice confidence at least 0.70; gallery Score and campaign Choice
adopt confidence at least 0.65. These are adoption policies, not calibration.
Invalid, missing, coerced, low-confidence or wrong-type responses preserve the
existing deterministic suggestion. Gallery scores still require the declared
0–4 provider range before mapping to the displayed 1–5 scale.

Heuristic mode guidance stays available as a prompt keyword suggestion without a
percentage, preserving the user's Switch control. Cinematic styling and camera
equipment words alone no longer imply video; camera movement still can. Gallery
labels and accessible text identify prompt-to-brand matching and its source,
without asserting pixel inspection. Campaign tags describe layout and distinguish
format heuristics from Jev confidence. Hero/thumbnail labels no longer imply
measured conversion or safety. Slot-position Top Pick awards were removed.

Prompt wording alone cannot establish an output defect or justify a paid retry.
Actual failed-slot retry controls, playable-result requirements and launch guards
are preserved. Format classification does not launch or retry a campaign.

## Verification and limits

All 12 initial evidence regressions fail on base. Parser/service and UI checks
cover actual provider confidence, heuristic guidance without fake percentages,
source-aware campaign tags, absence of unearned awards, and static-camera versus
camera-motion routing. The final selected suite covers central judgments, direct
generation controls, campaign status and gallery rendering/accessibility/
interactions. These structural tests use simulated service boundaries and do not
establish a genuine account, generation, inspection or production journey.

One direct live Jev fixture chose image mode for a cinematic watercolor static
album-cover prompt (jev-1.14.0; 397 input / 40 output tokens). It is a semantic
smoke check, not calibration, proxy acceptance or model-training evidence.

Other judgments and deterministic patterns still need calibration and consumer
review. Actual image/video quality verification, cumulative semantic/monetary
budgets, durable effect recovery and exact-deployed genuine-account acceptance
remain open in the original primitives objective. No merge or deployment is
performed by this branch.

Local validation passed: 560 selected tests across seven judgment/UI suites,
followed by focused gallery verification after the final accessible-text change;
renderer typechecking; touched lint with three existing warnings and no errors;
staged test-quality and whitespace checks. Live deployed acceptance remains open.
