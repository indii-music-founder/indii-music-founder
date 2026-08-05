# ISSUE-1164 Design Handoff: 3-Surface Icon Colorways

**Issue:** App icon/favicon gives no visual cue for which surface is open (web / Electron / remote)  
**Status:** ⏳ BACKLOG (design phase)  
**Severity:** 🟡 MEDIUM (UX/orientation — no data or security impact)  
**Requested by:** William (2026-07-12 — juggling multiple open browser/app tabs, can't tell them apart at a glance)

---

## What We Need

**Three distinct icon color variants of the same core "double eye"/`II` logo mark:**

1. **Web Browser** — used for browser tabs, PWA home screen (when opened in web)
2. **Electron Desktop App** — used for Dock icon, taskbar, alt-tab switcher, installer
3. **Remote/Mobile PWA** — used for phone home screen when remote control is installed as PWA

### Design Constraint
- **Same shape/mark** — do NOT redesign the logo itself
- **Only color changes** — pick 3 distinct color tokens so the icons are glanceable at a glance
- **Consistent feel** — all three should feel like variants of the same product

---

## Current Icon Files (Locations)

### Web
- `packages/renderer/public/favicon.svg` (current, single color)
- `packages/renderer/public/manifest.json` (references favicon, used for browser + PWA)

### Electron Desktop
- `build/icon.icns` (macOS app icon)
- `build/icon.ico` (Windows app icon)
- `build/icon.png` (Linux app icon)

### Mobile Remote (PWA)
- **Does NOT exist yet** — needs new manifest + icons
- Will be created at: `packages/renderer/public/manifest-remote.json` (separate from main)

---

## Acceptance Criteria

✅ Looking ONLY at the icon (browser tab, Dock, phone home screen) is enough to tell which of the 3 surfaces (web / Electron / remote) is open, with **no other UI visible**.

---

## Deliverables from Design Agent

### Option A: SVG + Hand-Off (Recommended)
1. Create one base SVG with CSS fill-color variables  
   - `--color-web: #XXXXXX` (web variant color)
   - `--color-electron: #XXXXXX` (Electron variant color)
   - `--color-remote: #XXXXXX` (mobile variant color)

2. Generate three `.svg` files:
   - `favicon-web.svg`
   - `favicon-electron.svg`
   - `favicon-remote.svg`

3. Color swatches/tokens for Electron native icons (`.icns`, `.ico`, `.png`):
   - Hex codes for web, Electron, remote variants
   - Any special requirements (transparency, minimum sizes)?

### Option B: Direct Variants
1. Three complete SVG variants ready to use
2. Color hex codes documented
3. Notes on resizing for Electron native formats

---

## Engineering Hand-In (After Design Complete)

Once you hand off the icons, I will:

1. **Web favicon:**
   - Update `packages/renderer/public/favicon-web.svg` 
   - Update `packages/renderer/public/manifest.json` to reference it

2. **Mobile remote PWA:**
   - Create `packages/renderer/public/favicon-remote.svg`
   - Create `packages/renderer/public/manifest-remote.json` (copy of main manifest but point to remote icon)
   - Route the `mobile-remote` module to use the separate manifest

3. **Electron desktop:**
   - Recolor `build/icon.icns`, `build/icon.ico`, `build/icon.png` with the Electron variant color
   - Test build + package

4. **Verification:**
   - Open web studio in browser → tab shows web-color icon
   - Open Electron app → Dock/taskbar shows Electron-color icon
   - Install mobile-remote PWA → phone home screen shows remote-color icon

---

## Examples (Reference — Feel Free to Ignore)

If you need inspiration on color schemes:
- **Web:** Bright/primary brand color (e.g., emerald-400)
- **Electron:** Darker/deeper variant (e.g., emerald-600)
- **Remote:** Accent/secondary color (e.g., cyan-500)

Or go totally different if it makes sense visually.

---

## How to Hand Off

1. **SVGs:** Export to `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder/design-assets/`
2. **Color codes:** Add to this doc or a separate `ICON_COLORS.md`
3. **Any special notes:** (resize ratios, transparency, etc.)

Then send me a message: **"ISSUE-1164 design ready — icon files at [path], colors are [web/electron/remote hex codes]"**

I'll pick it up from there and integrate into the build.

---

**Status:** Ready for design handoff  
**Issue Link:** `.agent/test_ledger/OPEN_ISSUES_V3.md` (line 567)
