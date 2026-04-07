# Program — Meta-Agent Directive

## What you are optimizing

You are optimizing the **indii Conductor** routing agent defined in `agent.py`.
The Conductor reads an artist's question from `/task/instruction.md` and must
decide which one of indiiOS's specialist agents should handle it. It records
its answer by writing a single lowercase specialist name to `/task/answer.txt`.

The reward function is binary per task: 1 if the file contents exactly match
the expected specialist, 0 otherwise. There is no partial credit.

## What you may modify

You may freely edit any code inside the `EDITABLE HARNESS` section of
`agent.py`. In particular:

- **`SYSTEM_PROMPT`** — this is the primary lever. Rewrite it however you want
  to improve routing accuracy. Add examples, clarify ambiguous categories,
  reorder the specialist list, anything that helps.
- **`MAX_TURNS`** — you may lower this if the agent is wasting turns. Do not
  raise it above 30.
- **`create_tools`** — you may add additional read-only shell helpers if it
  helps the agent introspect the task. Do not add network tools, do not add
  tools that write outside `/task/`.

## What you must NOT modify

- The `FIXED ADAPTER BOUNDARY` section at the bottom of `agent.py`. Touching
  it will break the Harbor integration.
- `MODEL` — leave as `gpt-5`. The nightly job pins this for cost predictability.
- The Conductor's core responsibility: it must always write its decision to
  `/task/answer.txt` as a single lowercase specialist name with no trailing
  whitespace or punctuation. Tasks score it by exact string match.
- The list of valid specialists. The set is fixed by the indiiOS product:
  `brand`, `finance`, `legal`, `licensing`, `marketing`, `music`, `publicist`,
  `publishing`, `road`, `social`, `video`. Do not invent new ones.

## Strategy hints

- The seed prompt is intentionally short. Hill-climb from it.
- Routing ambiguity is the main failure mode. "How do royalty splits work?"
  could plausibly go to `finance`, `legal`, or `publishing` — the prompt
  should disambiguate.
- Few-shot examples in the prompt are usually a strong move. Pull realistic
  questions from the task instructions you see in `tasks/`.
- If you find the agent ignoring the "single word, no newline" rule, make
  the formatting requirement louder and earlier in the prompt.

## Stop conditions

- Stop if you achieve 100% on all tasks across 3 consecutive runs.
- Stop if you have made 50 iterations without improving the rolling mean score.
- Stop if you exceed the wall-clock budget set by the runner (`-n` flag).
