# AutoAgent Sidecar Subsystem

This directory contains the Python sidecar implementation of the automated prompt engineering loop powered by [`kevinrgu/autoagent`](https://github.com/kevinrgu/autoagent). It hill-climbs on system prompt variations for the indii Conductor to maximize routing accuracy against the seed and user evaluation tasks.

## Prerequisites

*   Python >=3.11
*   Docker (running locally for Harbor task isolated environments)
*   [uv](https://astral.sh/uv/) Python package manager

## Installation

Sync the virtual environment and fetch the required dependencies:

```bash
uv sync
```

## Running Phase A Loop Proof (Local Smoke Test)

To verify that the optimization harness executes properly end-to-end against the local routing seed task, run:

```bash
OPENAI_API_KEY=sk-your-key-here uv run harbor run -p tasks/ \
  --task-name routing-isrc -l 1 -n 1 \
  --agent-import-path agent:AutoAgent \
  -o jobs --job-name smoke
```

### Options Explained
*   `-p tasks/`: Directory containing Harbor evaluation tasks.
*   `--task-name routing-isrc`: Run only the specific routing verification task.
*   `-l 1`: Search depth / learning iterations limit.
*   `-n 1`: Cap on number of prompt mutations evaluated.
*   `--agent-import-path agent:AutoAgent`: Imports the standard `AutoAgent` class declared in `agent.py`.
*   `-o jobs --job-name smoke`: Output job run artifacts folder.

## Synchronization Cycle

Winning prompt deltas discovered by the meta-learning agent are synced back to the modern Node.js/TypeScript Conductor source file:
*   Conductor prompt target: [agents/conductor/prompt.md](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indii-music-founder/agents/conductor/prompt.md)
*   Sync script: `scripts/sync_winning_prompt.py` (Phase B implementation)