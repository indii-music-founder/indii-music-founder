---
name: error-memory
description: Use this skill BEFORE debugging ANY error. Checks the Error Ledger for known solutions to prevent re-solving already-fixed issues.
---

# Error Memory: Never Fix the Same Error Twice

This skill enforces a **lookup-first** protocol for error handling. Before attempting any fix, you MUST check the Error Ledger for known solutions.

---

## ⚡ Quick Start (MANDATORY WORKFLOW)

When you encounter an error:

1. **STOP** – Do not immediately attempt a fix.
2. **CHECK LEDGER** – Open `ERROR_LEDGER.md` in this directory and search for matching patterns.
3. **CHECK MEM0** – Query `mcp_mem0_search-memories` with the error message as the query.
4. **APPLY FIX** – If a match is found, apply the documented solution verbatim.
5. **DOCUMENT NEW** – If this is a genuinely new error, add it to the ledger after solving.

---

## Pattern Matching Guide

When searching the ledger, look for:

- **Exact error messages** (e.g., `Unsupported output video duration`)
- **Error codes** (e.g., `403`, `PERMISSION_DENIED`)
- **API/Module context** (e.g., Vertex AI, Firestore, Veo)
- **Symptom keywords** (e.g., `CORS`, `permissions`, `deprecated`)

---

## Adding New Errors

When you solve a NEW error (not in the ledger), add an entry using this format:

```markdown
## [ERROR_ID] Short Descriptive Title

**Pattern:** `Exact error message or key regex`
**Context:** Where this error occurs (file, module, API)
**Root Cause:** Why this error happens
**Fix:** Step-by-step solution with code examples if needed
**Date Added:** YYYY-MM-DD
**Related Errors:** Links to similar ERROR_IDs if any
```

Use these ID prefixes:

- `API-XXX` – General API errors
- `FIRESTORE-XXX` – Firestore/Firebase errors
- `VERTEXAI-XXX` – Vertex AI/Gemini errors
- `VEO-XXX` – Video generation errors
- `BUILD-XXX` – Build/compilation errors
- `TYPE-XXX` – TypeScript type errors
- `AUTH-XXX` – Authentication errors
- `CORS-XXX` – CORS/network errors

---

## mem0 Integration

For cross-session memory, use these patterns:

**To search for known solutions:**

```javascript
mcp_mem0_search-memories(query="<error message or pattern>", userId="indiiOS-errors")
```

**To add a new solution:**

```javascript
mcp_mem0_add-memory(
  content="ERROR: <pattern> | FIX: <solution summary> | FILE: <relevant file>",
  userId="indiiOS-errors"
)
```

---

## Why This Matters

> "The definition of insanity is doing the same thing over and over and expecting different results."

Every hour spent re-debugging a known error is an hour stolen from building new features. This system converts debugging wins into permanent institutional knowledge.
