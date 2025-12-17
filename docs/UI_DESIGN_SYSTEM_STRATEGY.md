# Global UI Design System Strategy: "The Resonant Interface"

## 1. Vision & Philosophy

**North Star Document**: `docs/2026_WEB_DESIGN_TRENDS.md`

The **indiiOS** interface is not just a tool; it is a **resonant environment** for creativity. We align with the **2026 Machine Experience (MX)** philosophy, balancing hyper-real AI capability with raw human authenticity.

It should feel:

* **Subliminal (MX)**: The UI "nudges more than notifies," receding when not needed to let content shine.
* **Alive (Kinetic)**: Elements breathe, pulse, and react to interactions. Typography is kinetic.
* **Artful (Wabi-Sabi)**: We embrace "Artful Intelligence"—incorporating subtle noise, grain (`.bg-noise`), and organic motion to counter AI sterility.
* **Resonant (Sonic)**: Interactions carry potential energy and are reinforced by **Sonic Feedback** (hums, clicks, whooshes).

## 2. Core Technology Stack

This stack is shared across the **Electron Studio App** and the **Web Landing Page** to ensure consistency.

* **Styling**: `tailwindcss` (v3.4+, moving to v4 for Web)
* **Logic/Structure**: `React 19` / `Next.js 16`
* **Base Components**: `shadcn/ui` (Radix Primitives)
* **Animation**: `framer-motion` (v12+) & `motion` primitives
* **Styling**: `tailwindcss` (v3.4+, moving to v4 for Web)
* **Logic/Structure**: `React 19` / `Next.js 16`
* **Base Components**: `shadcn/ui` (Radix Primitives)
* **Animation**: `framer-motion` (v12+) & `motion` primitives
* **3D/Visuals**: `@react-three/fiber` (R3F) & `three.js`

## 3. Component Kit Strategy ("Tip of the Arrow")

We are adopting a composite strategy using three specialized libraries to accelerate development while maintaining a premium feel.

### A. Prompt Kit (AI Interaction Layer / MX)

* **Role**: Enabling **Agentic UX** and **Conversational Navigation**. Shifting from static forms to dialogue-based intent.
* **Components to Adopt**:
  * `PromptInput`: Replacing raw inputs. Must support multi-modal (Text, Audio, Image).
  * `ChatContainer`: Structuring the "Machine Experience" to be readable and human.
* **Directive**: The interface should feel like a dialogue, not a form. "Get me in" (Intent) vs "Sign Up" (Action).

### B. Motion Primitives (Micro-Interactions)

* `Toolbar`: For dynamic, expanding action menus (Command Bar).
* `AnimatedNumbers`: For stats and currency usage.

### C. Kokonut UI (Layout & Complex Blocks)

* **Role**: High-velocity implementation of complex UI patterns.
* **Components to Adopt**:
  * `File Upload`: **Priority 1**. Replace the basic drop zone with a polished, high-experience upload component involved in drag-and-drop workflows.
  * `AI Input Search`: Potential candidate for the global "Omnibar".
  * `Bento Grid`: For the Dashboard and Landing Page feature showcases.

## 4. Design Token System

### A. Color Palette ("The Frequency Theme")

* `--void` (`#030303`): The deepest black background.
* `--resonance-blue` (`#2E2EFE`): Primary action/brand color. Electric, digital.
* `--frequency-pink` (`#FE2E9A`): Accent/Highlight color. Creative energy.
* `--signal-white` (`#F0F0F0`): Primary text. High contrast but not harsh.

### B. Typography

* **Sans**: `Geist Sans` (Modern, legible, technical but human).
* **Mono**: `Geist Mono` (For code, IDs, and metadata).

### C. Effects

* `.glass-panel`: Standard container style.
  * `bg-white/2`, `blur-xl`, `border-white/5`
* `.text-glow`: Used for emphasis. A soft bloom behind text.

## 5. Implementation Roadmap

### Phase 1: Foundation (Current)

* [x] Tailwind & Globals setup.
* [x] 3D Background (`SoundscapeCanvas`).
* [x] Digital Billboard Carousel.

### Phase 2: Landing Page Polish (Immediate Next Steps)

1. **Motion Text**: Upgrade the "Artful Intelligence" and "Your Music" headlines using `TextEffect`.
2. **Feature Grid**: Implement a `Bento Grid` section below the fold to show off App capabilities (Studio, Network, AI).
3. **Command Bar**: Add a visual representation of the app's Command Bar interface on the web.

### Phase 3: Studio App Revamp

1. **File Drop**: Replace the current upload zone with **Kokonut's File Upload**.
2. **AI Chat**: Refactor `app/assistant/page.tsx` to use **Prompt Kit**.
3. **Daisychain UI**: Use **Motion Primitives** to animate the flow between agents.

## 6. Development Rules

1. **No Ad-Hoc CSS**: If it can be a Tailwind class, it must be.
2. **Animation is Essential**: No element appears abruptly. Everything fades, slides, or scales.
3. **Mobile First**: The Landing Page must be perfect on iPhone. The Studio App is Desktop-focused but must degrade gracefully.
