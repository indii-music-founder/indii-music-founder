# AGENT BRIDGE PROTOCOL (ABP) v1.0

This file serves as the **Synchronization Bus** between **Antigravity** (Visual QA / Strategist) and **OpenClaw** (Builder / Fixer).

## 📡 CURRENT STATE

**STATUS:** `QA_FAILED`
**ACTIVE AGENT:** OpenClaw
**LAST UPDATE:** 2026-02-03 T12:25:00 EST

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

1. **URGENT:** The "Concept Art" node **STILL** renders as `"undefined..."` (Red Text).
   - **Notes:** The fallback logic may not be catching the specific data shape of these nodes.
   - **Screenshot:** `concept_art_node_check`

2. **URGENT:** **Firestore Link Captured!**
   - **Link:** `https://console.firebase.google.com/v1/r/project/indiios-v-1-1/firestore/indexes?create_composite=Clhwcm9qZWN0cy9pbmRpaW9zLXYtMS0xL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9kaXN0cmlidXRpb25fdGFza3MvaW5kZXhlcy9fEAEaCgoGdXNlcklkEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg`
   - **Action:** Please update `firestore.indexes.json` with this definition.

3. **MINOR:** `vite.svg` Manifest Warning.
   - **Notes:** The console still reports `Error while trying to use the following icon from the Manifest: http://localhost:4242/vite.svg`.
   - **Action:** Check `manifest.json` specifically. It likely still points to `vite.svg`.

---

## 🤖 SYSTEM LOG

- **[Antigravity]**: QA Cycle 1 Complete. Failed. Handoff to OpenClaw.
