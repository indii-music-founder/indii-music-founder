# Triage Labels

The engineering skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in indii's GitHub issue tracker.

| Triage Role | Label in indii | Meaning | Color |
| --- | --- | --- | --- |
| Needs Evaluation | `triage/eval-needed` | Maintainer needs to assess and scope | 🔴 Red |
| Needs Information | `triage/awaiting-info` | Blocked: waiting on reporter for clarification | 🟠 Orange |
| Ready for Agent | `triage/ready-for-agent` | Fully specified, AFK agent can pick up | 🟢 Green |
| Ready for Human | `triage/ready-for-human` | Scoped and ready for human implementation | 🔵 Blue |
| Won't Fix | `wontfix` | Decided not to pursue | (default) |

## Triage State Machine

```
┌─────────────────┐
│ New Issue       │
└────────┬────────┘
         │ (apply: triage/eval-needed)
         ▼
┌─────────────────┐     needs more info      ┌──────────────────┐
│ Under Review    │ ──────────────────────▶  │ Awaiting Reporter │
└────────┬────────┘                         └────────┬─────────┘
         │ (apply: triage/ready-for-agent            │ (when info received)
         │  or triage/ready-for-human)               │
         │                                           ▼
         │                            ┌─────────────────────┐
         │ ◀──────────────────────────│ (re-triage)         │
         │                            └─────────────────────┘
         │
         ├─▶ triage/ready-for-agent ──▶ Agent picks up
         │
         ├─▶ triage/ready-for-human ──▶ Human picks up
         │
         └─▶ wontfix ──▶ Closed
```

## When a Skill Mentions a Triage Role

Use the label string from the **"Label in indii"** column above.

For example:
- "Apply the AFK-ready label" → apply `triage/ready-for-agent`
- "This needs triage" → apply `triage/eval-needed`
- "Waiting on the reporter" → apply `triage/awaiting-info`
