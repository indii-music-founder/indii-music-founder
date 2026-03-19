# Agent Training Log

Running log of all prompt changes, dataset additions, and score improvements per agent.
Update this file after every agent training session.

---

## Format

```
### [DATE] [AGENT_ID] — [BRIEF DESCRIPTION]
- Baseline score: X/35
- Changes made: [bullet list]
- New score: Y/35
- Dataset: [N] examples added (gold/silver/bronze)
- Next steps: [what's still needed]
```

---

## Log

### 2026-03-19 `generalist` — Initial audit & infrastructure setup

- Baseline score: **15/35** (Clarity:3, Specificity:3, ToolAlign:4, FewShot:1, EdgeCase:2, Routing:2, GuardRails:0)
- Changes made:
  - Added ROUTING TABLE with all 19 specialist domains and trigger keywords
  - Added AMBIGUITY PROTOCOL for multi-domain queries
  - Added SECURITY PROTOCOL block (identity lock, injection defense, domain boundary)
  - Added 5 worked examples covering routing, direct answer, tool use, and adversarial
  - Added explicit HANDOFF PROTOCOL
  - Added `delegate_task` examples for each specialist
- New score: **27/35** (Clarity:4, Specificity:4, ToolAlign:4, FewShot:4, EdgeCase:4, Routing:4, GuardRails:3)
- Dataset: 20 gold examples added → `docs/agent-training/datasets/generalist.jsonl`
- Next steps:
  - Route to `finance` next for audit
  - Wire `indii_oracle` to score live responses in dev
  - Consider adding a few more adversarial examples once security tests pass

---

<!-- Future entries will be appended below -->
