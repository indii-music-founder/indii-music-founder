# Global UI Design System Strategy: "The Resonant Interface"

## 1. Vision & Philosophy

**North Star Document**: `docs/2026_WEB_DESIGN_TRENDS.md`

The **indii** interface is not just a tool; it is a **resonant environment** for creativity. We align with the **2026 Machine Experience (MX)** philosophy, balancing hyper-real AI capability with raw human authenticity.

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

## 4. Design Token System & Neuro-Aesthetics

*Reference Master Specification:* `docs/design/DESIGN_AESTHETICS.md`

### A. Color Palette ("Sovereign Luxury: Champagne Gold + Molten Ruby")

* `--piano-black` (`#000000`): Pure void baseline; OLED true black lacquer.
* `--studio-obsidian` (`#14100C`): Warm studio acoustic dark backdrop.
* `--champagne-gold` (`#FFD700` / `#FFB800`): Primary identity, prestige, and dopamine activation.
* `--molten-ruby` (`#E53935` / `#C62828`): Subsurface kiln ember pools; urgency and spend catalyst.
* `--amber-ember` (`#E65100`): Terminal gradient anchor for molten CTA buttons.
* `--petroleum-teal` (`#00B8D4`): Cold studio analog accent balancing warm gold/ruby pools.
* `--signal-white` (`#FFFFFF`): Primary headlines and high-contrast typography.

### B. Typography

* **Sans**: Geist Sans / System Display (Modern, legible, technical but human). Fluid clamped for desktop 1440x900 fold compliance.
* **Mono**: Geist Mono / JetBrains Mono (For code, DDEX IDs, and timestamps).

### C. Effects & Component Styling

* `.lacquer-card`: Semi-translucent obsidian container (`bg-black/70`, `backdrop-blur-2xl`, `shadow-[0_25px_70px_rgba(0,0,0,0.95)]`).
* `.specular-line-gold`: Hairline razor reflection across top borders (`linear-gradient(90deg, transparent 0%, rgba(255,184,0,0.7) 50%, transparent 100%)`).
* `Molten CTA Gradient`: `bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#E65100]` with dual aura `shadow-[0_0_28px_rgba(255,184,0,0.48),0_0_45px_rgba(229,57,53,0.28)]`.

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
