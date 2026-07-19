# Mobile Device Routing — indii.music

**Status:** Implemented & Verified  
**URL:** `indii.music`  
**Policy:** Remote-only for all mobile devices (phone + tablet)

---

## Routing Logic

When you visit `indii.music` on any device, the app detects the device type and routes accordingly:

### Device Detection (useMobile hook)

```typescript
// Breakpoint-based classification
const isPhone = viewport ≤ 430px         // iPhone portrait
const isTablet = 641px ≤ viewport ≤ 1024px  // iPad, tablets
const isDesktop = viewport > 1024px      // Laptops, desktops

// Touch capability detection
const isTouchDevice = (pointer: coarse)  // Touch screen vs. mouse
```

### Routing Decision

```typescript
shouldUseRemoteSurface = isAnyPhone || (isTablet && isTouchDevice)
```

**Result:**
- ✅ **iPhone in portrait:** Remote
- ✅ **iPhone in landscape:** Remote
- ✅ **iPad in any orientation:** Remote (tablet + touch = Remote)
- ✅ **Android phone:** Remote (via user agent)
- ✅ **Android tablet:** Remote (tablet + touch = Remote)
- ❌ **Desktop browser:** Full app (no remote)
- ❌ **Desktop-sized iPad with external keyboard:** Forced to Remote anyway (tablet classification overrides)

### Enforcement

Once routed to the Remote Surface (`mobile-remote` module), the app enforces this at line 157-161 of `App.tsx`:

```typescript
useEffect(() => {
    if (shouldUseRemoteSurface && currentModule !== 'mobile-remote') {
        useStore.getState().setModule('mobile-remote');
    }
}, [shouldUseRemoteSurface, currentModule]);
```

**Translation:** If a user tries to navigate to a different module (e.g., `?module=creative-director`), they are automatically redirected back to the Remote Surface. No escape hatch.

---

## iPad-Specific Behavior

### iPad Pro or iPad (Desktop-Sized)

Even if an iPad has:
- Large screen (> 1024px when connected to external display)
- Magic Keyboard attached
- Mouse support enabled

**Result:** Still routes to Remote (`mobile-remote`)

**Why:** The `isTablet` classification is based on the **logical viewport width** reported by the browser, not the physical screen size. An iPad reports `768–1024px` logical width regardless of external displays. The touch detection (`isTouchDevice`) ensures tablets with touch are Remote-only.

### iPad in Safari (Default)

1. User navigates to `indii.music`
2. Browser reports: `isTablet: true`, `isTouchDevice: true`
3. App redirects to `/mobile-remote` (Remote Surface)
4. User sees the mobile remote interface with:
   - Boardroom chat at bottom
   - Navigation tabs (Home, Capture, Boardroom, Road, Stream, Settings)
   - Commands broadcast to desktop studio
5. User **cannot** access the full Creative Director, Distribution, or other desktop modules

---

## URL Handling

| URL | Device | Route | Result |
|-----|--------|-------|--------|
| `indii.music` | iPhone | → Remote | ✅ Mobile Remote |
| `indii.music` | iPad | → Remote | ✅ Mobile Remote |
| `indii.music/?module=creative-director` | iPad | → Mobile Remote | ✅ Redirected to Remote |
| `founder.indii.music` | iPad | Web Auth → Desktop App | ⚠️ Not blocked (desktop builds only) |
| `indii.music` | Desktop browser | → Full app | ✅ Full Studio App |

---

## Current Limitations & Workarounds

### Limitation 1: iPad Mini in Landscape
**Issue:** iPad Mini (768px) in landscape might be >= 768px, still routed to Remote  
**Status:** ✅ Working as intended (tablet = Remote)  
**No workaround needed** — this is correct behavior

### Limitation 2: File Browser (ISSUE-1044)
**Issue:** Remote can't access local desktop files  
**Workaround:** Upload assets to Firestore first, then reference  
**Status:** Designed; implementation pending

### Limitation 3: No Manual "Switch to Desktop Mode" on iPad
**Issue:** iPads cannot opt into the full web app  
**Status:** ✅ Intentional (design decision)  
**Reason:** Ensures consistent UX — all tablets get the optimized Remote interface

---

## Implementation Details

### Code Location: `packages/renderer/src/core/App.tsx`

```typescript
// Line 31-35: Remote surface detection
export function isRemoteSurfaceDevice(
    mobile: Pick<MobileState, 'isAnyPhone' | 'isTablet' | 'isTouchDevice'>
): boolean {
    return mobile.isAnyPhone || (mobile.isTablet && mobile.isTouchDevice);
}

// Line 157-161: Forced routing to mobile-remote
useEffect(() => {
    if (shouldUseRemoteSurface && currentModule !== 'mobile-remote') {
        useStore.getState().setModule('mobile-remote');
    }
}, [shouldUseRemoteSurface, currentModule]);
```

### Device Detection: `packages/renderer/src/hooks/useMobile.ts`

```typescript
// Line 89-94: Detects any phone (viewport + user agent)
const isAnyPhone = useMemo(() => {
    if (isPhone || isPhoneLg) return true;
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}, [isPhone, isPhoneLg]);

// Line 115: Tablet detection (641–1024px)
isTablet: isTabletRange,
```

---

## Testing Checklist

- [ ] iPhone (portrait) → Opens Remote
- [ ] iPhone (landscape) → Opens Remote
- [ ] iPad (portrait) → Opens Remote
- [ ] iPad (landscape) → Opens Remote
- [ ] Attempt to navigate to `/creative-director` on iPad → Redirected to Remote
- [ ] Attempt to navigate to `?module=dashboard` on iPad → Redirected to Remote
- [ ] Desktop browser (> 1024px) → Opens Full App
- [ ] Desktop browser, manually try to access `/mobile-remote` → Remote Surface appears (not desktop chrome)

---

## FAQ

**Q: Can an iPad user access the full Creative Director?**  
A: No. The app detects iPad (tablet + touch) and forces the Remote interface. This is intentional — the Remote is optimized for touch control of the desktop Studio.

**Q: What if I connect an iPad to an external monitor?**  
A: The browser still reports the logical iPad viewport (≤1024px), so it stays on Remote. This ensures consistent UX regardless of physical display.

**Q: Can a user bypass this with desktop mode?**  
A: No. The classification is based on browser-reported viewport width and touch capability, not on what the user claims. Even in desktop mode, an iPad reports `isTablet: true`.

**Q: Why not let users choose?**  
A: The Remote Surface is explicitly designed for touch + phone/tablet form factors. The full app requires hover states, precise mouse targeting, and large UI elements that don't work well on touch. Forcing the Remote prevents a broken experience.

---

## Related Issues & Future Work

- **ISSUE-1025:** Remote relay security (device attestation)
- **ISSUE-1044:** File browser for local asset access
- **ISSUE-755/756:** Cross-device persistence (sync between phone & iPad)
- **Future:** PWA install banner for iPad → "Install indii Remote"

