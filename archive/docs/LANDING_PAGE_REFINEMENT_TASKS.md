# Landing Page Refinement Plan

This document tracks the execution of the three visual refinement projects for the indiiOS landing page.

## Project 1: "Kinetic Intelligence" (Billboard Upgrade)

**Goal:** Replace static text with "alive", decoding, and breathing typography.

- [x] **Create `ScrambleText` Component:**
  - [x] Built with `framer-motion`.
  - [x] Logic: Splitting text into characters. Randomly cycling characters before settling on the final letter (The "Matrix/Code" feel).
  - [x] Props: `text`, `trigger` (to restart animation on slide change).
- [x] **Create `BreathingText` Wrapper:**
  - [x] Built with `framer-motion`.
  - [x] Logic: Continuous, subtle scaling (1.0 -> 1.02 -> 1.0) and opacity fluctuation (0.9 -> 1.0).
- [x] **Integrate into `DigitalBillboard.tsx`:**
  - [x] Replace standard `<h1>` with `ScrambleText` for the main headline.
  - [x] Wrap subheadlines in `BreathingText`.
  - [x] Ensure animations trigger cleanly when the carousel slide changes.

## Project 2: "The Void Ocean" (3D Background Tuning)

**Goal:** Shift from "mathematical wireframe" to "organic, deep ocean" with film grain.

- [x] **Add Global Noise Overlay:**
  - [x] Update `globals.css` to include a fixed `::after` on the body with a base64 noise texture or CSS filter.
  - [x] Set blending mode to `overlay` or `soft-light` with low opacity to "de-digitalize" the 3D canvas.
- [x] **Tune `WaveMesh.tsx`:**
  - [x] **Speed:** Reduce the `uTime` speed multiplier in the shader/useFrame to 0.5x or less for heavy, massive movement.
  - [x] **Color:** Deepen the blacks (`void`) and darken the blue/pink highlights to be more subtle "bioluminescence" rather than neon lights.
  - [x] **Fog:** Adjust `fog` density in `SoundscapeCanvas` to fade edges into pure black earlier.

## Project 3: "Tactile Control" (Audio UI Polish)

**Goal:** Make interactions feel physical and weighted.

- [x] **"Magnetic" Button Interaction:**
  - [x] Refactor `AudioManager.tsx` buttons to use `motion.button`.
  - [x] Config: Scale down to `0.95` on press, `1.05` on hover.
  - [x] Transition: High stiffness spring (Apple-style physics).
- [x] **Visual Feedback Replacements:**
  - [x] Remove native `alert()` for the Camera button.
  - [x] Implement a "Glitch" feedback: When clicked, the icon momentarily flickers red/white or the text "ACCESS DENIED" or "COMING SOON" flashes over the button itself.
