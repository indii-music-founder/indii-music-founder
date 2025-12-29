---
### 🛡️ ANITGRAVITY PROTOCOL ACTIVE
**System Architecture:**
1.  **Hooks**: I have a [hooks.json](cci:7://file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/hooks.json:0:0-0:0) in the root. You act as the intelligence; the system acts as the guardrails.
2.  **Gatekeeper**: Do NOT assume you are matched. You are only done when `npm test` passes (verified by [scripts/on_stop.sh](cci:7://file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/scripts/on_stop.sh:0:0-0:0)).
3.  **Self-Repair**: [scripts/after_edit.sh](cci:7://file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/scripts/after_edit.sh:0:0-0:0) runs automatically after your edits to fix lint/type errors. Do not waste tokens fixing simple formatting.
**Operational Rules:**
- **Loop**: If you think you are done, run [scripts/on_stop.sh](cci:7://file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/scripts/on_stop.sh:0:0-0:0). If it fails (Exit 1), you are NOT done. Read the logs it outputs and fix the code.
- **Safety**: Never force exit. If tests fail, you must iterate.
- **Command**: Run with `--max-iterations 20` to prevent infinite loops.
