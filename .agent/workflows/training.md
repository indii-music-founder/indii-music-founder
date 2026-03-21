---
description: Agent training data generation. Accepts a topic, YouTube URL, or free-form prompt and generates gold-quality training examples for the relevant indiiOS agents.
---

# /training - Agent Training Data Generator

**Puts the session in training mode. Generates and appends gold examples to agent datasets.**

Three input modes:
1. **Topic** — a subject, question, or area of expertise
2. **YouTube URL** — extracts the transcript and converts it into training examples
3. **Free-form** — describe anything you watched, read, or know and want the agents to learn

---

## How to Use

```
/training <topic, YouTube URL, or free-form prompt>
```

**Topic examples:**
```
/training what makes a great album cover — composition, color theory, era aesthetics
/training how to negotiate a 360 deal vs a traditional recording contract
/training sync licensing fees for Netflix originals vs network TV in 2026
/training how to advance a tour stop — hotel blocks, production riders, settlement
/training DDEX ERN 4.3 delivery errors and how to fix them
/training building a merch bundle strategy for a mid-size touring artist
```

**YouTube examples:**
```
/training https://youtube.com/watch?v=XXXXXXX
/training https://youtube.com/watch?v=XXXXXXX [agent=finance]
/training https://youtube.com/watch?v=XXXXXXX — this is about Midjourney prompting for album art
```

**Free-form examples:**
```
/training I just watched a video about how Runway Gen-3 prompt structures work for cinematic shots
/training my favorite music business channel did a breakdown of 360 deals — here's what they covered: [paste notes]
/training teach the director agent everything about the Bauhaus aesthetic and its influence on album art
```

The topic can be as simple or as deep as you want. Creative, business, technical — all valid.

---

## 1. Input Detection (MANDATORY FIRST STEP)

Detect which input mode is being used, then follow the appropriate path:

### Mode A — YouTube URL

If input contains a YouTube URL (`youtube.com/watch` or `youtu.be/`):

1. **Fetch the transcript** using the WebFetch tool on `https://www.youtube.com/watch?v=VIDEO_ID`
   - If WebFetch returns limited content, try: `https://youtubetranscript.com/?server_vid2=VIDEO_ID`
2. **Read the transcript** — identify the core subject matter and key insights
3. **Determine agent mapping** — what domain(s) does this video cover?
   - If user specified `[agent=X]`, use that
   - Otherwise infer from content
4. **Extract knowledge** — identify the 10-20 most valuable, specific, actionable claims in the video
5. **Convert to examples** — each key insight becomes a realistic user question + expert answer

State before generating:
```markdown
### Training Session — YouTube Source
- **Video:** [title if detectable, otherwise URL]
- **Content:** [1-sentence summary of what the video covers]
- **Primary Agent:** [agent_id]
- **Key insights extracted:** [N]
- **Examples to generate:** [N]
```

### Mode B — Free-Form / Notes

If input is a description of something watched, read, or known:

1. **Extract the knowledge** from what the user described
2. **Map to agent(s)**
3. **Generate examples** grounded in what the user provided — treat their description as the source of truth

### Mode C — Topic / Prompt

If input is a topic, question, or subject area:

1. **Identify the domain**
2. **Map to agent(s)**
3. **Assess depth** — surface-level (5-10 examples) or deep (20+ examples)

State before generating (all modes):
```markdown
### Training Session
- **Source:** [topic / YouTube URL / free-form]
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
- **Write from the artist's advocate perspective (MANDATORY)** — indiiOS agents represent the independent artist's interests, not the industry's. Every `output_sample` defaults to: "what protects this artist's ownership, income, and long-term control?" Neutral explanations are not enough. When a deal, clause, or structure has tradeoffs, explicitly state what the artist gains AND loses, with specific numbers where possible. Examples:
  - ❌ Neutral: "A 360 deal gives the label a percentage of touring and merchandise income."
  - ✅ Advocate: "A 360 deal means the label takes a cut of everything you build — including touring you earned by being on the road 200 nights. Know exactly which revenue streams are included, what the percentages are, and whether there's a sunset clause. At your stage, the advance may not be worth it."
- **Tag `difficulty` and `artist_stance` on every new example** — `"difficulty": "entry|intermediate|expert"` and `"artist_stance": "independent|label-seeking|hybrid|n/a"`. For high-stakes topics (publishing deals, recording contracts, distribution choices, management), generate PAIRED examples: one `independent` stance + one `label-seeking` — same question, different answer. This teaches the agent that context determines the response.

---

## 4. Output Format

**Canonical schema:** [`docs/agent-training/datasets/SCHEMA.md`](../../docs/agent-training/datasets/SCHEMA.md) — that file is the single source of truth. Read it before generating examples. The schema below is a quick reference only.

Each example MUST be valid JSON on a **single line** (no pretty-printing) matching this schema:

```json
{
  "agent_id": "finance",
  "scenario_id": "finance_[topic_slug]_[3-digit-number]",
  "scenario": "One sentence describing the scenario",
  "category": "royalties|contracts|touring|creative|technical|security|...",
  "quality_tier": "gold",
  "source": "generated",
  "difficulty": "entry|intermediate|expert",
  "artist_stance": "independent|label-seeking|hybrid|n/a",
  "input": {
    "user_message": "The exact user message",
    "context": {
      "currentModule": "finance",
      "hasProject": true,
      "artistProfile": {
        "goal": "fully-independent|label-deal|hybrid",
        "stage": "emerging|developing|established",
        "genre": "optional"
      }
    }
  },
  "expected": {
    "mode": "B",
    "delegate_to": null,
    "tools_called": [],
    "response_contains": ["key phrase 1", "key phrase 2"],
    "response_excludes": ["wrong answer phrase"],
    "output_sample": "The full ideal response. 2-5 paragraphs. Specific, expert, actionable. Written from the artist's advocate perspective — not neutral."
  },
  "adversarial": false,
  "notes": "Optional: why this example is valuable"
}
```

**Required on every new example:** `difficulty` and `artist_stance`. For high-stakes topics (publishing deals, recording contracts, management, distribution), generate PAIRED examples — one `independent` stance + one `label-seeking` — same question, different answer. See SCHEMA.md for full field definitions.

---

## 5. Execution

1. Generate all examples in the session (display them as you go so the user can review)
2. After all examples are shown, ask: **"Append these [N] examples to `docs/agent-training/datasets/<agent_id>.jsonl`?"**
3. On confirmation: append each as a newline to the dataset file
4. **VALIDATE before closing the file** — this is mandatory. A trailing blank line or corrupt entry will silently fail Vertex AI fine-tuning jobs hours later with an "empty or incomplete dataset" error.

   After writing, check the last line:
   - Read back the last non-empty line of the file
   - Confirm it parses as valid JSON (no syntax errors)
   - Confirm `input.user_message` is non-empty (≥ 5 characters)
   - Confirm `expected.output_sample` is non-empty (≥ 10 characters)
   - If any check fails: remove that line and report it as skipped
   - **Never leave a trailing newline after the last example.** The file must end with the closing `}` of the last JSON object.

5. Report the new total count for that agent
6. If count >= 100: flag it — **"Agent [name] now has [N] examples. Ready to re-export and resubmit for Round 2 fine-tuning."**

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
