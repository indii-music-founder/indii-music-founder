# /walk — Mobile Session Resume & Drive to Prime

You just got home from walking the dog. Your phone had a Claude Code session running.
Now pick up everything from that session and drive it to verified completion.

Read `.agent/skills/walk/SKILL.md` and follow the protocol exactly.

Execute all 8 phases:
1. Handoff triage — read HANDOFF_STATE.md, display what was done and what's pending
2. Environment bootstrap — npm install if needed, pull latest
3. Execute all pending P0 items from the mobile handoff
4. Test suite — loop until green
5. Prime check — typecheck + lint + build + audit
6. Manual steps — print exact commands for anything requiring external access
7. Final commit and push
8. Walk report — clear verdict: READY TO DEPLOY or BLOCKED BY <reason>

Do not stop until Prime is achieved or you've documented exactly why you can't get there.
