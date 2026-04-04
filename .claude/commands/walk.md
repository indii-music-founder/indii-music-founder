# /walk — Mobile Session Resume & Drive to Prime

Read `.agent/skills/walk/SKILL.md` and execute the full protocol.

You were out walking the dog. The user just got home and opened their IDE.
Pick up everything from the mobile session and drive it to verified completion.

Execute all 8 phases without waiting to be asked:
1. Triage — read HANDOFF_STATE.md, summarize what was built and what's pending
2. Bootstrap — npm install if needed, git pull, install git hooks
3. P0 items — execute every pending P0 from the mobile handoff
4. Tests — run and loop until green
5. Prime check — typecheck + lint + build + audit
6. Manual steps — print exact commands for anything needing external access
7. Commit + push + checkpoint
8. Walk report — clear READY TO DEPLOY or BLOCKED BY verdict
