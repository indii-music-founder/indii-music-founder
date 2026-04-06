# Design Review Implementation Plan (Founders Release)

## Objective

Execute the UI/UX polish identified during the `indiiOS_design_review` to ensure a $100M "Antigravity" premium aesthetic for the Founders Release.

## Target Files & Required Changes

1. **`src/modules/dashboard/components/PlatformCard.tsx`**
   - *Issue:* Cognitive load / Real estate on the dashboard. Clashing green checkmarks.
   - *Fix:*
     - Convert the open feature grid into a sleek, dismissible or collapsible element. We will make the overarching `PlatformCard` more compact vertically (reduce padding).
     - Swap `text-green-500` checkmarks (`CheckCircle2` / `Check`) for a premium `text-amber-500` or `text-white/80` to maintain color harmony with the amber Founders theme.

2. **`src/modules/dashboard/components/AgentWorkspace.tsx`** (or the respective floating command bar component)
   - *Issue:* The command input background matches the page background exactly, flattening the design.
   - *Fix:* Ensure the input wrapper has `bg-white/[0.03] backdrop-blur-md` to pop off the background and create a true glassmorphism layer effect, enhancing depth.

3. **`src/modules/founders/FoundersCheckout.tsx`**
   - *Issue:* A strangely aggressive blue glow hugging the viewport edges. Low contrast on the "Genesis investment guarantees" text.
   - *Fix:*
     - Remove the `shadow-[inset_0_0_100px_rgba(59,130,246,0.2)]` or similar viewport-edge blue glow classes from the main container. Let it organically fade to pure `#0d1117` black.
     - Increase the contrast of the subtext `text-gray-500` -> `text-gray-400`.

## Architecture & Verification

- Verify the changes using the `browser_subagent` if necessary (focusing locally or verifying code logic).
- Run `npm run typecheck` and `npm run lint` to assure 100% build stability.
- Ensure snapshot tests pass (specifically if `PlatformCard` or `Dashboard` are snapshot tested).
- Commit with conventional messages.
