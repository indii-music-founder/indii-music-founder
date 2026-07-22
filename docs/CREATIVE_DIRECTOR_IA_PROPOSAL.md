# Creative Director — Information Architecture Proposal

> **Status:** PROPOSAL — awaiting William's decision. Do NOT restructure tabs/panels until an option is picked.
> Covers ledger ISSUE-488 (too many tabs / panels float over wrong views), ISSUE-489 (VERSIONS vs PLP unclear),
> ISSUE-491 (Keyframes ⇄ Daisy Chain redundancy), ISSUE-496 (history fragmented across 3 surfaces).
> Grounded in the competitive scan in `.agent/test_ledger/OPEN_ISSUES_V2.md` (Photoshop/Firefly, Krea).
> Honors MEMORY: no buzzwords/"Nexus", YAGNI (rename/surface use cases over adding modes).

## 1. Current state (audit)

**Top tabs (`CreativeNavbar`):** Generate · Canvas · Video · Omni Remix · Showroom · Keyframes (6)
**Right-rail panels:** Brand · Versions (Design History) · Prompt History · Roster · PLP toggle
**Plus:** the Magic-Edit editor (`CreativeCanvas`), opened from a gallery item (a 7th surface with no tab).

**Problems:**
- **6 generation tabs** that overlap in purpose. Generate / Video / Omni Remix / Showroom / Keyframes are all "make an asset," differing mostly by output type or model — Krea unifies these into one canvas + model picker.
- **Keyframes (Sequence Architect) ≈ Video's Daisy Chain toggle** — both chain frames into longer sequences (ISSUE-491). Built in parallel; one should absorb the other.
- **3 history surfaces:** Design History + Prompt History + the Versions panel's prompt list (ISSUE-496). Photoshop's model is one nondestructive layers/versions concept tied to the canvas.
- **Panels float over unrelated views** (e.g., PLP/Versions over Keyframes). Overlap-stacking was fixed in #199 (mutually exclusive), but they still appear regardless of context.
- **VERSIONS vs PLP unlabeled** (ISSUE-489): "15 versions" = PLP campaign variants; Versions = design snapshots. Neither explains itself.

## 2. Three options

### Option A — Minimal cleanup (lowest risk, ~1–2 days)
Keep the 6 tabs. Do only:
1. **Merge the 3 history surfaces** into one "History" drawer with sub-tabs (Designs / Prompts / Versions) — closes 496.
2. **Add one-line in-panel explainers** to Versions and PLP — closes 489.
3. **Context-gate the panels** so PLP/Versions/Roster only show where they apply (e.g., PLP not on Keyframes) — finishes 488's overlap concern.
4. **Label Keyframes and Daisy Chain** to clarify they differ (or hide Keyframes if it's the weaker dup) — partial 491.
- ✅ Ships fast, low regression risk, no workflow relearning. ❌ Leaves the 6-tab sprawl intact.

### Option B — Photoshop-style: canvas + contextual bar + layers history (medium, ~1 week)
- Collapse **Generate + Canvas + Magic-Edit** into one canvas workspace; edit controls + model picker appear contextually on selection (Photoshop "Contextual Task Bar").
- **History = nondestructive layers** on the canvas, each recording its prompt + model — replaces all 3 history panels (closes 496 structurally).
- Keep Video / Showroom / Keyframes as distinct modes (different output pipelines).
- ✅ Matches the strongest pro-tool pattern; fluid generate↔edit. ❌ Bigger build; layer-history is a real feature, not just a move.

### Option C — Krea-style: single canvas-first workspace + mode/model picker (largest, ~2 weeks)
- One workspace. A **mode/model picker** replaces tabs: Image / Video / Mockup (Showroom) / Sequence (Keyframes+Daisy Chain merged) — closes 488 + 491.
- Chat becomes **canvas-aware** (479 already wired) or is demoted; direct canvas manipulation is primary.
- History/versions as in Option B.
- ✅ Cleanest IA, matches where the market is heading. ❌ Largest change; highest relearning + regression risk.

## 3. Recommendation

**Phased: ship Option A now, then evolve toward B.**
A closes 489/496 and the rest of 488 cheaply and immediately, with near-zero risk. It also forces the history consolidation that B/C both need, so it's not throwaway work. Defer the bigger canvas-unification (B, then optionally C) to a dedicated design pass once A is live and we can watch how the consolidated surfaces get used.

**Decision needed from William:** A, B, or C (or A-now-then-B). 491 specifically: keep Keyframes, keep Daisy Chain, or merge into one "Sequence" mode? Once chosen, a junior agent implements; this doc becomes the spec.
