# Creative judgment provenance — 2026-11-13

Base: origin/main 981d02397. Branch: codex/creative-judgment-provenance-20261113.

## Reproduced gaps

Creative preset selection substituted confidence 0.89 for missing or invalid
provider confidence; prompt improvement substituted 0.88. Their deterministic
fallbacks also reported numeric confidence (0.88 / 0.85). The rewrite service
presented that heuristic value as a confidence percentage to its reasoning model.

Prompt improvement could adopt a Jev archetype while keeping technical direction
from the old deterministic fallback. For example, adopting graphic cover and
typography after a cinematic keyword match retained anamorphic-lens descriptors.
Preset lookup used the in operator, accepting inherited names such as constructor.

## Resulting behavior

Both verdict types now distinguish Jev evidence (numeric provider confidence) from
heuristic evidence (null confidence). Their source describes preset/archetype
selection; deterministic control mappings, brand-color heuristics and technical
mappings are not additional model judgments.

Both consumers adopt only typed Choice responses with finite confidence between
0.65 and 1 and a declared choice. Otherwise they preserve their deterministic
suggestion. The threshold is an explicit adoption policy, not demonstrated
semantic calibration. Preset membership requires an own key.

The Creative Hub recommendation badge says Prompt suggestion for deterministic
suggestions and Jev suggestion after an adopted provider result. The rewrite
prompt identifies heuristic classification without inventing a percentage; an
adopted Jev classification retains its actual provider confidence. Technical
focus derives from the adopted archetype, with distinct photo, cinematic, 3D,
graphic/typographic and editorial mappings.

## Verification

All 14 initial provenance/coherence regressions fail against the base
implementation. With the fix, 550 structural tests across four parser, service
and UI suites pass, including the visible source-label transition, rewrite prompt
evidence, invalid confidence, inherited preset names and adopted-archetype focus.
Renderer typechecking and touched lint pass with two existing warnings. Staged
test-quality and whitespace checks passed.

A bounded live Jev check preferred technical descriptors derived from the adopted
graphic archetype and identified the deterministic suggestion as heuristic
(jev-1.14.0; 504 input / 72 output tokens). This supports the design choice and is
not code certification or semantic calibration.

No product image/video generation, live account acceptance, merge or deployment
was performed. The UI tests use service doubles and establish local rendering
contracts only. Other judgment consumers, additive ranking, cross-consumer
calibration, cumulative semantic budgets and genuine exact-deployed acceptance
remain open in the original primitives review.
