## 2024-05-20 - [Tailwind CSS Classes in Tests]

...

## 2026-01-11 - [Zombie State Crashes Interaction]

...

## 2026-01-11 - [Spam-Click Vulnerability in Save Action]

**Learning:** Purely functional handlers without explicit "loading" state tracking in the UI (even if using toast.loading) allow buttons to remain interactive during async operations, leading to potential race conditions or double-submissions.
**Action:** Always wrap async click handlers with a local `isProcessing` state (e.g., `isSaving`) and bind it to the button's `disabled` prop, ensuring the UI is locked until the promise resolves/rejects.

## 2026-01-11 - [Dead-Click UI Hallucinations]

**Learning:** UI elements that look interactive (hover effects, cursor change) but lack `onClick` handlers create "Dead-Click" hallucinations, leading users to believe the app is frozen.
**Action:** Audit all iconography-only buttons (Likes, Saves, Anchors) for functional handlers. If logic is missing, implement a placeholder feedback loop (Toast/Log) to maintain interaction continuity.

## 2026-01-11 - [Silent Dead Clicks in Action Bars]

**Learning:** Buttons without explicit `onClick` handlers inside containers with their own click handlers often present as "functional" to the developer but fail to trigger specific intended actions (e.g., a 'Maximize' icon that should open a lightbox but just triggers the parent's generic selection). This dilutes the UX and confuses users who expect a specific reaction to a specific icon.
**Action:** Always verify that every action icon in a toolbar has an explicit handler or bubbles to the correct logic with proper feedback. Test these explicitly using `data-testid` on the icon-button, not just the parent.

## 2026-01-11 - [Daisychain Interaction Verification]

**Learning:** Testing single-click interactions is necessary but insufficient for verifying complex UX workflows. A success in Click 1 might pass, but if the state transition for Click 3 is broken (e.g., passing the wrong UUID to a refined item), the entire "Daisychain" fails. Multi-step interaction tests uncover "Prop Drilling" and "Global State Sync" issues that unit tests miss.
**Action:** Implement integrated "Daisychain Tests" for primary workflows (e.g., Gallery Selection → Canvas Edit → Whisk Addition). Ensure stateful mock wrappers are used to simulate store transitions accurately.
