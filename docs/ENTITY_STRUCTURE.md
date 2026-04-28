# Entity Structure & Legal Ownership

**Purpose:** Clarify the corporate relationship between New Detroit Music LLC and IndiiOS for acquisition diligence.

---

## Controlling Entity

**Legal Name:** New Detroit Music LLC  
**Status:** Active  
**Role:** Owns all intellectual property, code, and assets of the indiiOS platform

---

## Asset Ownership

| Asset | Owner | Registration | Status |
|-------|-------|--------------|--------|
| DDEX Party ID | New Detroit Music LLC | `PA-DPIDA-2025122604-E` | ✅ Active, verified |
| indiiOS Codebase | New Detroit Music LLC | GitHub: `the-walking-agency-det/indiiOS-Alpha-Electron` | ✅ Verified |
| Firebase Project | New Detroit Music LLC | GCP Project: `223837784072` (indiios-v-1-1) | ✅ Verified |
| Stripe Connect Account | New Detroit Music LLC | — | ⚠️ <TBD by William> |
| Domain Names | New Detroit Music LLC | — | ⚠️ <TBD by William> |

---

## Naming Convention in Codebase

The codebase includes references to both "IndiiOS LLC" and "New Detroit Music LLC":

- **`CLAUDE.md`:** Lists `Org: IndiiOS LLC` (marketing/product naming)
- **`package.json`:** May list `IndiiOS LLC` in author field
- **DDEX Config (`src/core/config/ddex.ts`):** Correctly references Party ID registered to `New Detroit Music LLC`

**Clarification:** "IndiiOS" is the **product name** and operates as a DBA (Doing Business As) under the parent company **New Detroit Music LLC**. "New Detroit Music LLC" is the **legal entity** that owns and develops indiiOS.

---

## For Acquirer Diligence

An acquirer will:

1. Verify New Detroit Music LLC has clean title to the DDEX Party ID via DDEX Inc. lookup
2. Confirm all subsidiary assets (code, Firebase project, domains) are owned by New Detroit Music LLC
3. Review any existing contracts or IP assignments that transfer ownership

**Recommendation:** Update codebase references to consistently refer to "New Detroit Music LLC" as the owner, with "indiiOS" as the product/brand name. This removes ambiguity during legal review.

---

**Last Updated:** 2026-04-26  
**Owner:** William Roberts (New Detroit Music LLC)  
**Audience:** Acquisition diligence teams
