# indiiOS Design Manifesto: The Resonant Interface (v2026.1)

## 1. Vision & Metaphilosophy
The **indiiOS** interface is a **resonant environment** for creativity, designed for the **2026 Machine Experience (MX)**. We bridge the gap between **Hyper-real AI Perfection** and **Raw Human Authenticity**.

### Core Pillars
*   **Subliminal (MX)**: The UI nudges more than it notifies. It recedes to let the creator's content lead.
*   **Alive (Kinetic)**: Every element breathes, pulses, and reacts. Interaction is a dialogue, not a command.
*   **Artful (Wabi-Sabi)**: We embrace imperfection through subtle noise, organic motion, and "drippy" textures.
*   **Resonant (Sonic)**: Design that you can "hear." Interactions carry potential energy, reinforced by sonic feedback.

---

## 2. The "Drippy" Aesthetic
The signature visual style of indiiOS is the **Drippy 2026 Aesthetic**—a fusion of high-intensity glassmorphism and liquid physics.

### Visual Components
*   **The "Wet Look"**: High-saturation backdrop blurs (`blur-xl`), increased contrast (`saturate-200`), and ultra-thin translucent borders.
*   **Liquid Borders**: Dynamic, pseudo-element borders that feel like they are flowing or "dripping" around containers.
*   **Spotlight Interaction**: Surfaces react to the cursor with radial gradients (`glowColor`) that follow movement, creating a sense of depth and focus.
*   **Noise & Grain**: A persistent, low-opacity noise overlay (`opacity-[0.04]`) adds tactile depth and counters AI sterility.
*   **Scanlines**: Subtle technical overlays (`opacity-[0.03]`) signal the platform's high-fidelity processing nature.

---

## 3. Design Tokens (The Frequency Theme)

### A. Color Palette
| Token | Hex | Usage |
| :--- | :--- | :--- |
| **Void** | `#030303` | Primary background; deepest OLED black. |
| **Resonance Blue** | `#2E2EFE` | Primary action; electric, digital energy. |
| **Frequency Pink** | `#FE2E9A` | Accent; creative life-force and highlights. |
| **Dopamine Pink** | `#FF0099` | Secondary accent; high-saturation optimism. |
| **Electric Blue** | `#00F0FF` | Technical highlights and data flow. |
| **Signal White** | `#F0F0F0` | Primary typography; high contrast, low harshness. |

### B. Gradients
*   **Tech Bro**: `Resonance Blue` to `Electric Blue` (The SaaS/AI standard).
*   **Dopamine**: `Dopamine Pink` to `Frequency Pink` (Creative energy).
*   **Liquid Chrome**: Multistop silver/white gradients for high-impact headlines.

### C. Typography
*   **Primary (Sans)**: `Geist Sans` (Technical but human, highly legible).
*   **Technical (Mono)**: `Geist Mono` (For metadata, IDs, and code-like elements).
*   **Hierarchy**: Oversized headlines (tracking-tighter) paired with tiny, wide-tracked uppercase secondary text (`tracking-[0.4em]`).

---

## 4. Interactive Architecture

### The Spotlight Card System
The primary container for all content. It must include:
1.  **Primary Glow**: Cursor-following radial gradient.
2.  **Secondary Blur**: Larger, softer secondary glow for "atmosphere."
3.  **Internal Sheen**: Gradient-to-tr from `white/0.02` to transparent.
4.  **Drippy Border**: High-intensity border with slight hover elevation (`hover:-translate-y-2`).

### Kinetic Motion (Framer Motion)
*   **No Abrupt Appearances**: Everything must fade, scale, or slide with high-damping springs (`stiffness: 100, damping: 20`).
*   **Capability Ticker**: Horizontal scrolling "data-streams" of keywords to signal operational supremacy.
*   **Scanline Pulses**: Step-based animations that mimic data flow across visual elements.

---

## 5. Implementation Directives

1.  **No Ad-Hoc CSS**: All styling must use Tailwind utility tokens or the centralized `index.css` system.
2.  **Mobile Perfection**: The landing experience must be "iPhone-Perfect," respecting touch targets and viewport constraints.
3.  **Accessibility as Default**: Minimum AA contrast, focus indicators, and support for "Reduced Motion" OS preferences.
4.  **Intent-Based Navigation**: Use "Agentic UX" patterns—Dialogue-based navigation ("Get me in") over traditional action buttons.

---

## 6. Sonic OS Identity
The UI is the visual representation of the **indiiOS Sonic DNA**.
*   **Audio Visualizers**: Real-time 4K synthesis of audio into visual manifests.
*   **Sonic Feedback**: Buttons "click," panels "whoosh," and the system "hums" with potential energy.

---

## 7. Production Integrity & Specialized Components
While aesthetics are "drippy" and "resonant," the interface must remain functionally ironclad.

### A. Safety Patterns
*   **ConfirmDialog**: All destructive actions (Delete, Remove, Cancel) must utilize the `ConfirmDialog` component. It uses the Radix `Dialog` primitive but follows the indiiOS aesthetic (glassmorphism + loading states).
*   **Data Loss Prevention**: The `useConfirmDialog` hook is the mandatory pattern for stateful confirmation flows.

### B. Compliance UI
*   **CookieConsentBanner**: GDPR-compliant, transparent tracking management. It must integrate with the "Resonant" theme—clear, non-intrusive, yet authoritative.
*   **Privacy Layers**: Interfaces involving sensitive data should use the "Fog" effect (high blur) when not in active focus.

---

## 8. Technical Implementation (CSS Utilities)
To maintain consistency, use the following pre-defined utility classes in `globals.css`:

### Class Definitions
*   `.glass-panel`: Implements the "Wet" look with `backdrop-filter: blur(30px) saturate(200%)` and subtle internal shadows.
*   `.drippy-border`: Uses a pseudo-element mask to create a high-fidelity, light-reactive edge without standard border limitations.
*   `.text-chrome`: Applies the `liquid-chrome` gradient to text, mimicking polished metal.
*   `.glow-text-[blue|pink]`: Applies multi-layered text shadows for a "neon-on-black" resonance effect.
*   `.animate-liquid`: A 15s ease-infinite background drift for gradient-heavy surfaces.
*   `.perspective-2000` & `.transform-style-3d`: Core utilities for creating high-depth layouts.

### Atmosphere Layer
The system uses a global **Grainy Texture Layer** (`body::after`) with `mix-blend-mode: overlay` at `0.05` opacity to create a physical, tactile surface across the entire viewport.

> **Directive**: If it looks static, add a pulse. If it looks dry, add a drip. If it looks silent, add a hum. If it's destructive, add a check. If it's code, make it mono.
