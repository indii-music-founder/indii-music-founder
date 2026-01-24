---
name: error-memory
description: BEFORE debugging, check Error Ledger/Mem0.
---

# Error Memory

**Protocol: Never Fix the Same Error Twice.**

## 1. Workflow (MANDATORY)

1. **STOP** (Don't code yet).
2. **CHECK** `ERROR_LEDGER.md` (Regex/Pattern match).
3. **SEARCH** `mcp_mem0_search-memories(query="ErrorMsg", userId="indiiOS-errors")`.
4. **MATCH?** Apply documented fix.
5. **NEW?** Fix, then Add to memory.

## 2. Knowledge Ingestion

**Add new solutions:**

```javascript
mcp_mem0_add-memory(
  content="ERROR: <Pattern> | FIX: <Summary> | FILE: <Path>",
  userId="indiiOS-errors"
)
```

## 3. Ledger Format

* `API-XXX`: API Errors
* `AUTH-XXX`: Firebase Auth
* `BUILD-XXX`: Build/TS
