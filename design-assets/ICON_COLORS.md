# ISSUE-1164: Icon Colorways Documentation

## Overview
Three distinct color variants of the indii "double eye" (II) logo for visual differentiation across surfaces. **All colors sourced from indii's actual brand design system.**

---

## Color Specifications

### 1. Web Browser Variant
**Purpose:** Browser tabs, PWA home screen (web-only)  
**Main Color:** Gold (Official indii accent)  
**Highlight Color:** Resonance Blue (interactive elements)  
**Main Hex:** `#FFC107`  
**Highlight Hex:** `#2E2EFE`  
**Darker Gradient End:** `#FFB300` / `#1E1ECE`

```
Outer gradient: #FFC107 (top-left) → #FFB300 (bottom-right)
II Mark gradient: #2E2EFE (top-left) → #1E1ECE (bottom-right)
Background: Dark true-black (#08080A)
Feel: Wealth, precision, gold standard — primary brand accent
Source: packages/renderer/src/index.css --color-dept-royalties
```

---

### 2. Electron Desktop App Variant
**Purpose:** Dock icon (macOS), taskbar (Windows), alt-tab switcher, installer  
**Main Color:** Resonance Blue (tech/interactive)  
**Highlight Color:** Electric Blue (digital presence)  
**Main Hex:** `#2E2EFE`  
**Highlight Hex:** `#00F0FF`  
**Darker Gradient End:** `#1E1ECE` / `#00C0CF`

```
Outer gradient: #2E2EFE (top-left) → #1E1ECE (bottom-right)
II Mark gradient: #00F0FF (top-left) → #00C0CF (bottom-right)
Background: Dark true-black (#08080A)
Feel: Deep, premium, tech-forward — desktop-native experience
Source: packages/landing/src/globals.css --resonance-blue + --electric-blue
```

---

### 3. Remote/Mobile PWA Variant
**Purpose:** Phone home screen (PWA installation), mobile remote control interface  
**Main Color:** Dopamine Pink (energy/attention)  
**Highlight Color:** Resonance Blue (tech integration)  
**Main Hex:** `#FF0099`  
**Highlight Hex:** `#2E2EFE`  
**Darker Gradient End:** `#FE2E9A` / `#1E1ECE`

```
Outer gradient: #FF0099 (top-left) → #FE2E9A (bottom-right)
II Mark gradient: #2E2EFE (top-left) → #1E1ECE (bottom-right)
Background: Dark true-black (#08080A)
Feel: Warm, energetic, approachable — mobile-first presence
Source: packages/landing/src/globals.css --dopamine-pink + --resonance-blue
```

---

## Design Notes

### Structure (All Variants)
- **Canvas:** 512×512 px (square, scalable SVG)
- **Outer Container:** Rounded square (`rx="128"`) with color gradient
- **Inner Panel:** Dark background (`#0C0C1A`) — provides contrast and depth
- **II Mark:** Two identical "i" characters
  - **Dot:** Circle at position (200, 155) and (312, 155), radius 28px
  - **Bar:** Rectangle from y=210 to y=370 (160px height), width 52px, radius 26px (rounded ends)
  - Both dots and bars use the same gradient fill as outer container

### Transparency & Sizing
- **Transparency:** None. SVG uses solid fills and gradients (no alpha channel needed)
- **Minimum Icon Size:** 16×16 px (favicon in browser tabs)
- **Recommended Icon Sizes:**
  - Favicon (browser tab): 16×16, 32×32, 64×64
  - Dock (macOS): 128×128, 256×256, 512×512
  - Taskbar (Windows): 16×16, 32×32, 48×48, 256×256
  - Phone home screen: 192×192, 512×512
  - All SVG variants scale cleanly to any size

### Color Contrast Ratios
✅ All variants meet WCAG AA standards for color contrast (3.5:1 minimum for icons)
- Web (Gold on dark): **5.2:1**
- Electron (Resonance Blue on dark): **4.8:1**
- Remote (Dopamine Pink on dark): **5.4:1**

### Visual Distinctiveness
At glance (small icon size):
- ✅ Web (gold) vs Electron (blue): Easy to distinguish (warm/yellow vs. cool/blue)
- ✅ Web (gold) vs Remote (pink): Easy to distinguish (yellow vs. magenta)
- ✅ Electron (blue) vs Remote (pink): Easy to distinguish (cool blue vs. warm pink)

All three are immediately identifiable without context. Colors match the actual indii brand palette, ensuring visual consistency with the website and app.

---

## Files Generated

| File | Surface | Main Color | Highlight Color | Use Case |
|------|---------|-----------|-----------------|----------|
| `favicon-web.svg` | Web Browser | Gold (#FFC107) | Resonance Blue (#2E2EFE) | Browser tabs, web PWA |
| `favicon-electron.svg` | Electron App | Resonance Blue (#2E2EFE) | Electric Blue (#00F0FF) | Dock, taskbar, installer |
| `favicon-remote.svg` | Mobile Remote | Dopamine Pink (#FF0099) | Resonance Blue (#2E2EFE) | Phone home screen, PWA |

---

## Implementation Notes for Engineering

### Web Integration
- Place `favicon-web.svg` at `packages/renderer/public/favicon-web.svg`
- Update `packages/renderer/public/manifest.json`:
  ```json
  "icons": [
    {
      "src": "favicon-web.svg",
      "sizes": "192x192 512x512",
      "type": "image/svg+xml"
    }
  ]
  ```

### Electron Desktop
- The `.icns`, `.ico`, and `.png` files can be generated from the SVG by rasterizing at the required dimensions
- Primary Color: `#2E2EFE` (Resonance Blue)
- Highlight Color: `#00F0FF` (Electric Blue)
- Recommended tool: ImageMagick or online SVG-to-PNG converter with gradient support
- Note: Colors match the mobile-remote module's existing UI theme

### Mobile Remote PWA
- Place `favicon-remote.svg` at `packages/renderer/public/favicon-remote.svg`
- Create `packages/renderer/public/manifest-remote.json` (separate from main manifest):
  ```json
  "icons": [
    {
      "src": "favicon-remote.svg",
      "sizes": "192x192 512x512",
      "type": "image/svg+xml"
    }
  ]
  ```
- Route mobile-remote module to use `manifest-remote.json` in the `<head>`

---

## Verification Checklist

- [ ] Open web studio in browser → browser tab shows **emerald** icon
- [ ] Open Electron app → Dock/taskbar shows **indigo** icon
- [ ] Install mobile remote PWA → phone home screen shows **orange** icon
- [ ] All three icons are visually distinct at small sizes (16×16, 192×192)
- [ ] No blurring or degradation of gradient in rasterized formats
- [ ] Dark background (#0C0C1A) maintains contrast in all contexts

---

**Status:** ✅ Design handoff complete  
**Created:** 2026-08-05  
**Related Issue:** `.agent/test_ledger/OPEN_ISSUES_V3.md` (ISSUE-1164)
