# Rebranding: indii → indii.music
**Status:** In Progress
**Start Date:** 2026-05-11
**Ownership:** William Roberts (will@indii.music)

---

## Vision
Rebrand from "indii" (a technical/OS naming) to **"indii.music"** — positioning the platform as an independence operating system **for music creators**, not just a technical product.

### Catchphrase / Tagline
> **"indii.music, your independence operating system"**

Variations:
- Short: "indii.music — your independence OS"
- Marketing: "indii.music: The independence operating system"
- Full: "indii.music, your independence operating system"
- Legal: "indii.music (indii)"

---

## Brand Identity Constants
**File:** `packages/renderer/src/core/config/branding.ts` ✅ **CREATED**

Central source of truth for all brand messaging, email addresses, and organizational details.

### Key Constants
- Official name: **indii.music**
- Organization: **New Detroit Music LLC**
- Domain: **indii.music**
- Founders email: **will@indii.music**
- Support email: **support@indii.music**

---

## Rebranding Checklist

### ✅ PHASE 1: Critical UI References (In Progress)
**Status:** 3/4 complete

| Item | File | Old | New | Status |
|------|------|-----|-----|--------|
| Page title | `packages/renderer/src/main.tsx:38` | `indii - Studio` | `indii.music — Studio` | ✅ |
| Startup fallback | `packages/renderer/src/startupFallback.ts:10` | `indii` | `indii.music` | ✅ |
| Push notifications | `packages/renderer/src/service-worker.ts:88` | `indii` | `indii.music` | ✅ |
| Auth gate message | `packages/renderer/src/core/components/auth/BiometricGate.tsx:112` | `indii` | `indii.music` | ✅ |

### 📋 PHASE 2: Configuration & Constants (Not Started)
**Scope:** Update all app-level configuration files

| Item | File | Change | Impact |
|------|------|--------|--------|
| Agent guidelines | `packages/renderer/src/core/agent-guidelines.json` | Update `"platform": "indii"` → `"indii.music"` | Affects agent system prompts |
| i18n localStorage key | `packages/renderer/src/core/i18n.ts` | Update key from `indii_language` → `indii_language` | Language preferences |
| Proprietary Ingestion IP trading name | `packages/renderer/src/core/config/ingestion.ts:TRADING_NAME` | `indii` → `indii.music` | Legal/distribution |
| Storage keys (app state) | `packages/renderer/src/core/store/slices/appSlice.ts` | Replace all `indii_` prefixes with `indii_` | App persistence |
| Agent UI config | `packages/renderer/src/core/store/slices/agent/agentUISlice.ts` | Update localStorage keys | UI preferences |

**Note:** Need to create migration path for existing users' localStorage to preserve preferences when renaming keys.

### 📋 PHASE 3: Documentation & Legal (Not Started)
**Scope:** Update all references in docs, comments, and legal text

| Category | Files | Changes |
|----------|-------|---------|
| Code comments | All files | Update references from "indii" to "indii.music" in docs/comments |
| Documentation | `docs/**/*.md` | Rebrand all documentation titles/descriptions |
| Type comments | `packages/renderer/src/types/AlwaysOnMemory.ts` | Update comments mentioning "indii" |
| Contract/legal text | `packages/renderer/src/core/components/ContractRenderer.tsx:48` | Update "Drafted by indii Legal Agent" |
| Call sheets | `packages/renderer/src/core/components/CallSheetRenderer.tsx` | Update "Produced by indii Studio" |
| Comments | `packages/renderer/src/core/components/CallSheetRenderer.tsx` | Review and update attributions |
| Distributor descriptions | `packages/renderer/src/core/config/distributors.ts` | Update all references to indii |
| Theme/brand guide | `packages/renderer/src/core/theme/moduleColors.ts` | Update brand guide reference |

### 📋 PHASE 4: Email & Contact Setup (Not Started)
**Scope:** Configure domain email addresses

| Email | Purpose | Status |
|-------|---------|--------|
| will@indii.music | Founders contact | 📋 To configure |
| support@indii.music | Customer support | 📋 To configure |
| legal@indii.music | Legal inquiries | 📋 To configure |
| security@indii.music | Security reports | 📋 To configure |
| sales@indii.music | Business development | 📋 To configure |

### 📋 PHASE 5: Firebase & Infrastructure (Not Started)
**Scope:** Update Firebase configuration and environment

| Item | File | Change |
|------|------|--------|
| Firebase console | Firebase Console | Rename project/app references if applicable |
| Cloud Functions | `packages/firebase/src/**/*` | Update error messages, logs mentioning indii |
| Environment variables | `.env.example` | Document new branding |
| README | `README.md` | Update project description |

### 📋 PHASE 6: Package & Build Config (Not Started)
**Scope:** Update build-time references

| File | Change |
|------|--------|
| `package.json` | Update description if present |
| `electron.vite.config.ts` | Update app names/branding |
| Build output | App name in installers/bundles |

### 📋 PHASE 7: Marketing & Web (Not Started)
**Scope:** Update landing page and public-facing copy

| Item | File | Change |
|------|------|--------|
| Landing page title | `packages/landing/**` | Update page title and headings |
| Open Graph meta | `packages/renderer/index.html` | Update `og:title`, `og:description` |
| Favicon title | HTML meta | Ensure consistency |
| Hero text | Landing page | Update with new tagline |

---

## Storage Key Migration Strategy

### Problem
Existing users have preferences stored with `indii_` prefix. Renaming to `indii_` breaks existing preferences.

### Solution
Create migration function in `appSlice.ts`:

```typescript
function migrateStorageKeys() {
  const oldPrefix = 'indii_';
  const newPrefix = 'indii_';
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(oldPrefix)) {
      const value = localStorage.getItem(key);
      const newKey = key.replace(oldPrefix, newPrefix);
      if (value) localStorage.setItem(newKey, value);
      localStorage.removeItem(key);
    }
  }
}
```

Call in `App.tsx` on first load (check version in localStorage).

---

## Execution Order

### Week 1 (May 11-17)
- [x] Phase 1: Critical UI updates (DONE THIS SESSION)
- [ ] Phase 2: Configuration & constants
- [ ] Phase 4: Email setup (wait for IT to configure domain)

### Week 2 (May 18-24)
- [ ] Phase 3: Documentation & legal references
- [ ] Phase 5: Firebase & infrastructure
- [ ] Storage key migration + testing

### Week 3+ (May 25+)
- [ ] Phase 6: Package & build config
- [ ] Phase 7: Marketing & web
- [ ] Full QA & launch

---

## Verification Checklist

**Before shipping rebranding:**

- [ ] All 4 Phase 1 UI items updated
- [ ] All configuration constants using `BRANDING` module
- [ ] Storage key migration tested with existing data
- [ ] No hardcoded "indii" in public-facing UI
- [ ] Firebase/Cloud Functions logs updated
- [ ] Landing page displays new branding
- [ ] Email setup complete (will@indii.music working)
- [ ] All documentation regenerated/updated
- [ ] Legal/contract text updated
- [ ] Build/deploy successful
- [ ] QA pass: brand consistency across all pages

---

## Notes

- **Founders Email:** `will@indii.music` — use in all founder-level communications
- **Brand Tone:** More casual, artist-focused (vs. technical/OS-focused)
- **Color/Design:** Keep existing (only text/naming changes for now)
- **Timeline:** Complete by end of May for v1.62.0 release

---

**Last Updated:** 2026-05-11
**Owner:** William Roberts (will@indii.music)
