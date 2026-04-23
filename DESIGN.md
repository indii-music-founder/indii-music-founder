# indiiOS Design System: The Resonant Interface

> **Philosophy**: Balanced at the edge of hyper-real AI perfection and raw human authenticity. We don't just build tools; we build resonant environments.

---

## 1. Vision & Metaphilosophy

The indiiOS interface follows the **2026 Machine Experience (MX)** philosophy. It is an adaptive ecosystem designed to be read by AI agents (AEO/GEO) while remaining deeply emotive for human creators.

### Core Pillars
- **Subliminal (MX)**: The UI "nudges more than notifies," receding to let content shine.
- **Alive (Kinetic)**: Elements breathe, pulse, and react. Interaction is a conversation.
- **Artful (Wabi-Sabi)**: Embracing imperfection through subtle noise, grain, and organic motion to counter AI sterility.
- **Resonant (Sonic)**: Every interaction carries potential energy, reinforced by a "Sonic OS" identity.

---

## 2. Visual Language & Atmosphere

### The Atmosphere ("The Void & The Glass")
- **Void Background**: Using true black (`#000000` / `#0d1117`) for OLED optimization and infinite depth.
- **Wet Glassmorphism**: Translucent layers (`.glass-panel`) with high blur (`30px`), saturation (`200%`), and ultra-thin borders.
- **Grainy Texture**: A subliminal noise overlay (`opacity: 0.05`) to add tactile "paper-like" quality to digital surfaces.
- **Chrome/Liquid**: High-fidelity silver gradients and liquid-motion borders for a "premium-experimental" feel.

### Color Systems

#### A. The Frequency Theme (Brand)
| Token | Value | Role |
| :--- | :--- | :--- |
| `--void` | `#030303` | Core background depth |
| `--resonance-blue` | `#2E2EFE` | Primary action / Brand signal |
| `--electric-blue` | `#00F0FF` | Digital flow / Highlights |
| `--frequency-pink` | `#FE2E9A` | Creative energy / Alerts |
| `--signal-white` | `#F0F0F0` | High-contrast technical text |

#### B. Department Color System (Functional)
Every department in the indiiOS ecosystem has a distinct "vibe" mapping:
- **Finance (Royalties)**: `#FFC107` (Gold/Amber) — Precision & Wealth.
- **Distribution**: `#2196F3` (Electric Blue) — Data flow & Logistics.
- **Marketing**: `#E91E63` (Magenta) — Energy & Attention.
- **Legal**: `#455A64` (Slate) — Stability & Protection.
- **Creative**: `#9C27B0` (Purple) — Passion & Magic.
- **Touring**: `#FF5722` (Deep Orange) — Road heat & Stage lights.
- **Publishing**: `#8BC34A` (Lime) — Growth & Catalog expansion.
- **Social**: `#00BCD4` (Cyan) — Viral connectivity.
- **Licensing**: `#009688` (Teal) — Secondary revenue deals.

---

## 3. Typography System

Typography is a primary design element, often treated as a physical object or kinetic force.

- **Main/Sans**: `Geist Sans` (or Inter fallback). Modern, legible, technical.
- **Mono**: `Geist Mono` (or JetBrains Mono). Used for code, IDs, metadata, and "Engineering Blueprint" sections.
- **Display**: Kinetic typography that reacts to scroll/mouse, often using exaggerated hierarchy (oversized headlines).

---

## 4. Motion & Interaction

### Movement Principles
1. **No Abrupt Starts**: Everything fades, slides, or scales. Use `framer-motion` for all state changes.
2. **The "Snappy" Feel**: Standard transitions at `0.25s` with `cubic-bezier(0.4, 0, 0.2, 1)`.
3. **Sonic Feedback**: Click, hum, and whoosh sounds reinforce tactile interactions.

### Signature Effects
- **Neon Glow**: Soft blooms behind department-colored elements (`.dept-glow`).
- **Bolt Pulse**: A signature 1.5s animation for AI/automation updates.
- **Liquid Drift**: Background gradients that drift slowly over 15s to maintain "aliveness".
- **Drip Effect**: Vertical "data drips" for active background processes.

---

## 5. Component Architecture

- **Bento Grids**: For feature showcases and data-heavy dashboards.
- **Prompt Kit (Agentic UX)**: Dialogue-based intent (Conversational Nav) instead of traditional forms.
- **Kokonut UI**: Complex patterns like the "Drippy" file upload and AI Search Omnibar.
- **Motion Primitives**: Animated numbers, floating toolbars, and "Text Effects".

---

## 6. Implementation Standards

- **No Ad-Hoc CSS**: Exclusively Tailwind CSS (v4 spec).
- **Asset Excellence**: Use **AVIF** and **WebP** only. Dithered images for retro-sections.
- **Performance**: LCP < 2.5s, INP < 200ms. "Fast is Green."
- **AI-Readability**: Mandatory Schema markup and 40-60 word summaries for AEO snippets.
- **Mobile-First**: Perfect parity on mobile for the Landing Page; graceful degradation for the Studio App.

---

> [!NOTE]
> This document is the "Source of Truth" for all frontend development. Before starting a feature, ask: "Does this feel Alive, Artful, and Resonant?"
