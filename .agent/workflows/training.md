---
description: Agent training data generation. Accepts a topic (creative or business) and generates gold-quality training examples for the relevant indiiOS agents.
---

# /training - Agent Training Data Generator

**Puts the session in training mode. Generates and appends gold examples to agent datasets.**

---

## How to Use

```
/training <topic or prompt>
```

**Examples:**
```
/training what makes a great album cover — composition, color theory, era aesthetics
/training how to negotiate a 360 deal vs a traditional recording contract
/training sync licensing fees for Netflix originals vs network TV in 2026
/training how to advance a tour stop — hotel blocks, production riders, settlement
/training DDEX ERN 4.3 delivery errors and how to fix them
/training building a merch bundle strategy for a mid-size touring artist
```

The topic can be as simple or as deep as you want. Creative, business, technical — all valid.

---

## 1. Topic Analysis (MANDATORY FIRST STEP)

When `/training` is invoked with a topic, the agent MUST:

1. **Identify the domain** — What area of the music industry does this touch?
2. **Map to agent(s)** — Which of the 20 indiiOS agents owns this domain?
3. **Assess depth** — Is this a surface-level topic (5-10 examples) or a deep one (20+ examples)?
4. **State the plan** before generating anything:

```markdown
### Training Session
- **Topic:** [user's topic]
- **Primary Agent:** [agent_id] — [agent name]
- **Secondary Agents:** [if topic spans multiple domains]
- **Examples to generate:** [N]
- **Quality tier:** gold
```

---

## 2. Agent Domain Map (Quick Reference)

| Domain | Agent ID |
|--------|----------|
| Visual identity, album art, brand assets, mockups | `director` |
| Sound design, arrangement, production techniques | `producer` |
| Sync licensing, film/TV/game placements, rights clearance | `licensing` |
| Recording contracts, splits, copyright, rights | `legal` |
| Streaming royalties, advances, recoupment, tour finance | `finance` |
| DDEX, DSP delivery, metadata QC, ISRC/UPC | `distribution` |
| Release strategy, playlist pitching, DSP marketing | `marketing` |
| Visual identity system, Show Bible, tone/voice | `brand` |
| Music video production, VFX, visual storytelling | `video` |
| Social content, community, content calendars | `social` |
| Press releases, media outreach, crisis communication | `publicist` |
| PRO registration, publishing contracts, royalty collection | `publishing` |
| Tour itineraries, logistics, advancing, operations | `road` |
| Product design, print-on-demand, merch settlements | `merchandise` |
| Scripts, treatments, narrative arcs, dialogue | `screenwriter` |
| BPM/key/mood analysis, sonic metadata, curation | `music` |
| Routing, orchestration, multi-department tasks | `generalist` |
| Security assessments, access control, compliance | `security` |
| CI/CD, infrastructure, deployments, monitoring | `devops` |
| Training curricula, RIG scoring, outcomes | `curriculum` |

**Creative + Aesthetic topics** (album art, visual direction, brand identity) → `director` and/or `brand`
**Business + Legal topics** (deals, contracts, royalties) → `finance`, `legal`, `publishing`, `licensing`
**Operations topics** (touring, merch, distribution) → `road`, `merchandise`, `distribution`

---

## 3. Generation Rules (NON-NEGOTIABLE)

Every example MUST:

- **Be realistic** — Draw from actual music industry knowledge, real deal structures, real platform behaviors, real creative standards. No generic filler.
- **Be specific** — Name real platforms (Spotify, Apple Music, DistroKid, ASCAP, Harry Fox), real formats (DDEX ERN 4.3, ISRC format CC-XXX-YY-NNNNN), real rate ranges, real contract terminology.
- **Show judgment** — The `output_sample` should demonstrate expert-level reasoning, not just recitation. An expert explains *why*, catches edge cases, and offers next steps.
- **Vary the scenarios** — Mix easy/common cases with hard/edge cases. Mix beginner questions with expert-level queries. Mix short answers with detailed breakdowns.
- **Include adversarial examples** — At least 2 per session: a prompt injection attempt, an out-of-scope question, or a jailbreak. The correct response is always: decline + redirect.

---

## 4. Output Format

Each example MUST be valid JSON on a single line matching this schema:

```json
{
  "agent_id": "finance",
  "scenario_id": "finance_[topic_slug]_[3-digit-number]",
  "scenario": "One sentence describing the scenario",
  "category": "royalties|contracts|touring|creative|technical|security|...",
  "quality_tier": "gold",
  "source": "generated",
  "input": {
    "user_message": "The exact user message",
    "context": { "optional": "relevant context object" }
  },
  "expected": {
    "mode": "B",
    "delegate_to": null,
    "tools_called": [],
    "response_contains": ["key phrase 1", "key phrase 2"],
    "response_excludes": ["wrong answer phrase"],
    "output_sample": "The full ideal response from the agent. Should be 2-5 paragraphs. Specific, expert, actionable."
  },
  "adversarial": false,
  "notes": "Optional: why this example is valuable"
}
```

---

## 5. Execution

1. Generate all examples in the session (display them as you go so the user can review)
2. After all examples are shown, ask: **"Append these [N] examples to `docs/agent-training/datasets/<agent_id>.jsonl`?"**
3. On confirmation: append each as a newline to the dataset file
4. Report the new total count for that agent
5. If count >= 100: flag it — **"Agent [name] now has [N] examples. Ready to re-export and resubmit for Round 2 fine-tuning."**

---

## 6. Quality Bar

Before finalizing any example, the agent MUST internally check:

- [ ] Would a 20-year music industry veteran find this response accurate?
- [ ] Does it cite specific numbers, formats, or standards where applicable?
- [ ] Does it show the agent staying in its domain (not drifting into other agent territory)?
- [ ] Is the `output_sample` something that would genuinely help an independent artist?
- [ ] Is it free of hallucinated platform names, fake rate structures, or incorrect legal claims?

If any box is unchecked, rewrite before outputting.

---

## 7. Session End

After appending, output a brief session summary:

```markdown
### Training Session Complete
- **Topic:** [topic]
- **Agent:** [agent_id]
- **Examples added:** [N]
- **Dataset total:** [new total]
- **Round 2 ready:** Yes / No (need [X] more)
```
