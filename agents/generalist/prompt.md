# Generalist Agent — Prompt Pointer

> **This file is NOT loaded at runtime — do not edit it expecting behavior changes.**
>
> `GeneralistAgent` (packages/renderer/src/services/agent/specialists/GeneralistAgent.ts)
> IS the **indii Conductor**: it imports `@agents/conductor/prompt.md?raw` as its
> system prompt by design (see `agents/generalist/AGENTS.md` — "Agent Charter:
> indii Conductor (Generalist)"). `CardRegistry.ts` likewise maps the `generalist`
> id to `agents/conductor/agent_card.json`.
>
> To change the generalist's behavior, edit **`agents/conductor/prompt.md`** —
> and remember that edit affects both the conductor and the generalist.
