# 🔒 API CREDENTIALS POLICY (PROTECTED DOCUMENT)

> [!CAUTION]
> **CHANGE CONTROL POLICY**
>
> This document is **READ-ONLY** for all AI agents.
>
> **NO AGENT may modify this file without EXPLICIT user approval.**
>
> If an agent suggests changes, they must:
>
> 1. Present the proposed change to the user
> 2. Wait for explicit written approval
> 3. Only then execute the modification
>
> **Violations are treated as terminal errors.**

---

## Current API Key Status

**Last Updated:** 2026-01-19T18:40:00-05:00  
**Updated By:** User + Antigravity Agent  
**Status:** ✅ OPERATIONAL

---

## Active Keys

### Primary AI Key: Gemini Developer API Key

| Property | Value |
| --- | --- |
| **Key ID** | `Gemini Developer API key` |
| **Project** | `indiios-v-1-1` |
| **Restrictions** | ✅ Restricted to **Generative Language API** |
| **Used In** | `.env` (VITE_API_KEY), `functions/.env` (GEMINI_API_KEY) |

### Firebase Auth Key: Browser key (auto-created by Firebase)

| Property | Value |
| --- | --- |
| **Key ID** | `Browser key (auto created by Firebase)` |
| **Project** | `indiios-v-1-1` |
| **Restrictions** | ✅ Restricted to 24 Firebase APIs (Identity Toolkit, etc.) |
| **Used In** | `.env` (VITE_FIREBASE_API_KEY) |

---

## Keys Requiring Attention

| Key Name | Issue | Recommended Action |
| --- | --- | --- |
| `indiiOS-Studio-Primary-2025` | ⚠️ Unrestricted | Add API restrictions |
| `API key 2` | ⚠️ Unrestricted | Add API restrictions or delete if unused |

---

## Environment Variable Mapping

```bash
# .env (Frontend - Vite)
VITE_API_KEY=<Gemini Developer API Key>
VITE_FIREBASE_API_KEY=<Gemini Developer API Key>

# functions/.env (Cloud Functions)
GEMINI_API_KEY=<Gemini Developer API Key>
```

---

## Validation Checklist (Before Any Key Change)

Before modifying API keys, verify:

- [ ] New key is from project `indiios-v-1-1` (NOT a different project)
- [ ] Key has appropriate API restrictions (not unrestricted)
- [ ] Key is not expired or about to expire
- [ ] Both `.env` AND `functions/.env` are updated together
- [ ] Dev server is restarted after changes (`npm run dev`)
- [ ] AI functionality is tested in browser after restart

---

## Incident Log

### 2026-01-19: Expired Key Incident

**Symptom:**

```
[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:streamGenerateContent?alt=sse: [400] API key expired.
```

**Root Cause:**

- Original `VITE_API_KEY` expired
- First replacement key was from wrong project (686237393884)
- Second replacement key was unrestricted

**Resolution:**

- Used browser agent to access GCP Console
- Identified properly restricted "Gemini Developer API key"
- Updated all `.env` files
- Verified AI functionality in browser

**Lesson Learned:**

- Always verify key belongs to correct project before using
- Prefer restricted keys over unrestricted
- Test in browser after any key change

---

## Emergency Recovery

If AI stops working due to key issues:

1. **Check the error message** — look for project ID mismatch or "key expired"
2. **Go to GCP Console:** <https://console.cloud.google.com/apis/credentials?project=indiios-v-1-1>
3. **Use the "Gemini Developer API key"** (already restricted)
4. **Update both files:**
   - `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/.env`
   - `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/functions/.env`

```bash
# lsof -ti:4242 | xargs kill -9 2>/dev/null; sleep 1; npm run dev
```

1. **Test:** Send a message in the Creative Orchestrator

---

## Agent Instructions

> [!IMPORTANT]
> **FOR ALL AI AGENTS:**
>
> 1. **You MAY NOT modify `.env` files** without explicit user approval
> 2. **You MAY NOT generate or rotate API keys** without explicit user approval
> 3. **You MAY diagnose** API key issues and propose solutions
> 4. **You MUST present changes** to the user before executing
> 5. **You MUST reference this document** when handling credential issues

---

**Document Hash:** `sha256:API_CREDENTIALS_POLICY_V1_2026-01-19`
