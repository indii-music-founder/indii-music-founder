# indii.music — Design Aesthetics & Neuro-Visual Architecture

**Canonical Status:** Active Standard  
**Revision:** 2026.2 (Post-Mastering Business OS)  
**Applies To:** `packages/landing` (Web), `packages/renderer` (Studio App), `packages/shared` (Brand Tokens)  

---

## 1. Executive Summary & Aesthetic North Star

indii.music is the first AI-native music business operating system for independent artists. It picks up where mastering ends, liberating the artist from label bureaucracy, gatekeepers, and fragmented SaaS tools.

The design aesthetic represents **Sovereign Luxury & Analog Craft**:
- **Not a cold, utilitarian SaaS dashboard.**
- **Not a commoditized, playful consumer app.**
- **A resonant, high-contrast creative studio environment** evocative of bespoke Swiss horology, luxury automotive instrumentation, hand-wired tube amplifiers, and high-gloss grand piano lacquer.

---

## 2. The Neuro-Psychological Engine: Champagne Gold + Molten Ruby

Human visual cognition and emotional arousal are deeply wired to color frequencies. The core conversion surfaces of indii.music leverage a dual neuro-chemical stimulation model.

```
                   ┌─────────────────────────────────────────┐
                   │    THE NEURO-AESTHETIC CONVERSION POLE   │
                   └────────────────────┬────────────────────┘
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
   CHAMPAGNE GOLD (#FFD700 / #FFB800)                    MOLTEN RUBY (#E53935 / #E65100)
   - Dopamine trigger                                    - Norepinephrine & sympathetic arousal
   - Sovereignty, prestige, illumination                 - Urgency, hunger, action threshold drop
   - Perceived investment & ownership value              - Catalyzes the "desire to spend / commit"
             │                                                     │
             └──────────────────────────┬──────────────────────────┘
                                        │
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │      GLOSS PIANO BLACK (#000000)        │
                   │      - Deep obsidian backdrop           │
                   │      - Subsurface kiln ember pools      │
                   │      - Dual-frequency specular auras    │
                   └─────────────────────────────────────────┘
```

### 2.1 Champagne Gold (`#FFD700` / `#FFB800`)
- **Psychological Trigger:** Dopamine pathway activation, reward anticipation, artistic sovereignty, prestige, and perceived value.
- **Cognitive Association:** Master gold records, precision brass acoustics, bespoke gold alloy calibers, institutional longevity.
- **Application:** Primary typography accents, active tab highlights, specular edge lines, and foreground CTA gradient crests.

### 2.2 Molten Ruby & Kiln Crimson (`#E53935` / `#C62828` / `#E65100`)
- **Psychological Trigger:** Norepinephrine release, sympathetic nervous system arousal, heightened metabolic focus, urgency, and the drop of risk aversion.
- **Cognitive Association:** Hot vacuum tube filaments, red studio "RECORDING" lamps, molten artisan kilns, high-performance red brake calibers behind forged gold wheels.
- **Conversion Role:** Overcomes hesitation. Shifts the user from passive admiration into decisive action—directly stimulating the **desire to invest, spend money, and secure founding access**.

### 2.3 The "Anti-Ketchup-&-Mustard" Rule (Critical Distinction)
> [!WARNING]
> In graphic design, combining yellow and red carelessly produces an immediate "fast-food / discount clearance / gas station" reaction (e.g., McDonald's, Shell, DHL). To protect sovereign luxury, **never place raw saturated primary yellow directly beside flat primary red on a white or light gray ground.**

**The Sovereign Luxury Execution:**
1. **Piano Black Obsidian Ground:** Everything sits on deep `#000000` or `#14100C` dark studio lacquer with subtle noise (`opacity: 0.02`).
2. **Subsurface Thermal Depth:** Molten ruby and crimson are never painted as flat boxes; they are deployed as **subsurface kiln embers** and volumetric light pools (`blur-[180px]`, `opacity: 0.04 - 0.07`) underneath or behind the champagne gold halos.
3. **Molten Ingot Gradients:** Actionable elements transition from high-luminous Champagne Gold (`#FFD700`) through Warm Gold (`#FFB800`) into a deep, glowing Amber Ember (`#E65100`).
4. **Dual-Frequency Specular Auras:** Shadows combine two distinct layers:
   - Primary: High-intensity amber/gold halo (`rgba(255, 184, 0, 0.48)`).
   - Secondary: Broad, deep molten ruby atmospheric wash (`rgba(229, 57, 53, 0.28)`).

---

## 3. Color Palette & Token Specifications

| Token Name | Hex / RGBA | Tailwind Utility / CSS | Psychological / Functional Role |
|---|---|---|---|
| **Piano Black** | `#000000` | `bg-black`, `bg-[#000000]` | Pure void baseline; OLED true black |
| **Studio Obsidian** | `#14100C` | `bg-[#14100C]` | Warm dark studio acoustic lacquer |
| **Specular Gold** | `#FFD700` | `from-[#FFD700]` | Specular crest, high-light reflection |
| **Champagne Radiant** | `#FFB800` | `via-[#FFB800]`, `text-[#FFB800]` | Primary gold identity, dopamine trigger |
| **Warm Amber Core** | `#CCA000` | `text-amber-400` | Secondary metadata labels, accent lines |
| **Amber Ember** | `#E65100` | `to-[#E65100]` | Molten gradient terminal; visceral heat |
| **Molten Ruby** | `#E53935` | `rgba(229, 57, 53, ...)` | Volumetric urgency pool, spend trigger |
| **Kiln Crimson** | `#C62828` | `rgba(198, 40, 40, ...)` | Deep subsurface kiln hearth |
| **Horizon Crimson** | `#D50032` | `rgba(213, 0, 50, ...)` | Deep atmospheric horizon glow |
| **Petroleum Teal** | `#00B8D4` | `bg-[#00B8D4]` | Cold analog accent, complementary balance |
| **Studio Green** | `#00C853` | `text-[#00C853]`, `bg-[#00C853]` | "Live / Active" status indicator |
| **Signal White** | `#FFFFFF` | `text-white` | Primary headlines, extreme contrast |
| **Muted Parchment** | `rgba(255,255,255,0.70)` | `text-white/70` | Body copy, secondary paragraphs |
| **Carbon Monospace** | `rgba(255,255,255,0.45)` | `text-white/45` | Technical metadata, timestamps, grid ticks |

---

## 4. Master Component Styling Patterns

### 4.1 Primary Conversion CTA (The Molten Ingot Pattern)
All primary conversion touchpoints (Hero Access, Founder Owner $2,500 License, Featured Pricing Tier, and Waitlist Submission) share this unified pattern:

```tsx
<a
  href="#waitlist"
  className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#E65100] px-6 py-3 text-xs md:text-sm font-black text-black shadow-[0_0_28px_rgba(255,184,0,0.48),0_0_45px_rgba(229,57,53,0.28)] transition-all hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(255,184,0,0.7),0_0_55px_rgba(229,57,53,0.45)]"
>
  <span>Get Founding Artist access</span>
  <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
</a>
```

### 4.2 Volumetric Atmospheric Halos (Warm Studio Lighting)
Layered background glows generate optical depth and intimacy without distracting from typography:

```tsx
{/* Volumetric Studio Lighting — Champagne Gold + Molten Ruby embers */}
<div className="absolute left-1/2 top-[-20rem] h-[65rem] w-[65rem] -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-500/[0.12] via-[#FFB800]/[0.06] to-transparent blur-[160px]" />
<div className="absolute left-[55%] top-[-8rem] h-[48rem] w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#E53935]/[0.07] via-[#C62828]/[0.03] to-transparent blur-[180px]" />
<div className="absolute left-[30%] top-[140rem] h-[42rem] w-[42rem] rounded-full bg-[#D50032]/[0.04] blur-[190px]" />
```

### 4.3 High-Gloss Lacquer Cards & Specular Hairlines
Cards mimic polished piano lacquer:
- Deep obsidian background: `bg-black/70` to `bg-black/90`
- Backdrop blur: `backdrop-blur-2xl`
- Outer shadow: `shadow-[0_25px_70px_rgba(0,0,0,0.95)]`
- Gold specular razor top-line:
  ```css
  .specular-line-gold {
    background: linear-gradient(90deg, transparent 0%, rgba(255,184,0,0.7) 50%, transparent 100%);
  }
  ```

---

## 5. Viewport Geometry & Motion Ergonomics

### 5.1 The 900px Desktop Fold Mandate
- **The Rule:** On a standard 1440×900 desktop screen, the core headline, sub-manifesto, and primary actionable CTA must be visible **above the 900px fold** without scrolling.
- **Layout Target:** Primary CTA button `top` coordinate must remain `y < 650px`.
- **H1 Typography Fluid Clamp:**
  `text-[12vw] sm:text-[9.5vw] md:text-[7.5vw] lg:text-[5.5rem] xl:text-[6.8rem] leading-[0.80] tracking-[-0.065em]`

### 5.2 Zero Scroll-Fade Blackout Rule
- **The Rule:** In-page scroll animations must **never degrade section opacity below 1.0**.
- **Historical Failure Mode:** Framer Motion's `useTransform(scrollYProgress, [0, 0.13], [1, 0.14])` previously faded the Hero and CTA buttons into pitch blackness as the user attempted to scroll and inspect the page.
- **Allowed Motion:** Subtle scale damping (`scale: [1, 0.96]`), gentle parallax Y displacement (`y: [0, 40]`), or subtle blur changes on background halos. Opacity must remain locked at `1.0`.

### 5.3 Ghost DOM Node Elimination
- Deferred sections (`LazySection`) must never render 0px height empty container nodes in public production mode. Unused founder sections must be gated conditionally at the parent level (`{founder && <LazySection ... />}`).

---

## 6. Typography Standard

- **Display & Headlines:** Heavyweight Sans (`font-black`), extreme negative letter-spacing (`tracking-[-0.055em]` to `tracking-[-0.065em]`), ultra-tight line height (`leading-[0.80]` to `leading-[0.90]`).
- **Metadata & System Markers:** Monospace (`font-mono`), uppercase, wide letter-spacing (`tracking-[0.16em]` to `tracking-[0.25em]`), tiny optical sizing (`text-[8px]` to `text-[10px]`).
- **Body & Declarations:** High-legibility sans (`font-medium` to `font-normal`), relaxed leading (`leading-relaxed`), muted contrast (`text-white/70`).

---

## 7. Quality & Integrity Invariants

1. **Brand Tagline Integrity:** `"music business at the speed of you"` — always all-lowercase, no punctuation, never modified.
2. **Preservation Tripwires:** Any design change must pass all assertions in `packages/landing/src/page.preservation.test.tsx`.
3. **Deterministic Performance:** Production bundle builds must compile cleanly in `< 5s` with zero TypeScript or lint errors.
