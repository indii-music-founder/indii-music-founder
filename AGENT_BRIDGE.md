# AGENT BRIDGE PROTOCOL (ABP) v1.0

This file serves as the **Synchronization Bus** between **Antigravity** (Visual QA / Strategist) and **OpenClaw** (Builder / Fixer).

## 📡 CURRENT STATE

**STATUS:** `PROTOCOL_INIT`
**ACTIVE AGENT:** Antigravity
**LAST UPDATE:** 2026-02-03 T12:00:00 EST

---

## 🤝 THE HANDSHAKE PROTOCOL

 To ensure we can work without a human loop, we must adhere to this State Machine:

### 1. States & Triggers

| State | Who Sets It? | Meaning | Trigger Action |
| :--- | :--- | :--- | :--- |
| `WAITING` | System | Idle state. | None. |
| `BUILD_COMPLETE` | **OpenClaw** | Code changes pushed to localhost. | **Antigravity** wakes up -> Starts QA. |
| `QA_IN_PROGRESS` | **Antigravity** | Visual tests running. | OpenClaw waits. |
| `QA_PASSED` | **Antigravity** | No visual defects found. | OpenClaw can commit/deploy. |
| `QA_FAILED` | **Antigravity** | Defects found. | **OpenClaw** reads `[NEEDS]` -> Starts Fix. |

### 2. Communication Structure

When writing to this file, use these strictly formatted blocks:

```markdown
## [QA REPORT]
- **Time:** <ISO_TIMESTAMP>
- **Result:** PASSED | FAILED
- **Visual Hash:** <SCREENSHOT_HASH_OR_NAME>
```

```markdown
## [NEEDS]
(Specific instructions for OpenClaw)
- Fix: "Concept Art" node has incorrect default data.
- Fix: "vite.svg" 404 error.
```

---

## 🚨 IMMEDIATE ACTION ITEMS (From Last QA)

### [NEEDS] (Assigned to OpenClaw)

1. **URGENT**: The "Concept Art" node in Workflow Lab renders as `"undefined..."`.
    * **Diagnosis**: Likely a missing `data` prop or initial state in the Node component.
    * **Action**: Locate the node definition and ensure `label` or `description` is initialized.
2. **URGENT**: `FirebaseError: The query requires an index`.
    * **Action**: Check `firestore.indexes.json` or run the query locally to get the index creation link.
3. **MINOR**: `vite.svg` 404.
    * **Action**: Check `public/` folder or `index.html` headers.

---

## 🤖 SYSTEM LOG

- **[Antigravity]**: Protocol defined. Waiting for OpenClaw to acknowledge by setting details below or fixing items.
