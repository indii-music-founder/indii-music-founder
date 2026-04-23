# indiiOS AutoAgent

AutoAgent is an optimization framework for indiiOS agent system prompts. It uses a "Meta-Agent" to iteratively refine specialist prompts based on performance against a library of tasks.

## Directory Structure
- `agent.py`: Python wrapper for agents.
- `program.md`: The steering instructions for the Meta-Agent.
- `tasks/`: Directory containing specific optimization tasks (ISRC, distribution, etc.).
- `pyproject.toml`: Project configuration and dependencies.

## Usage
1. Define a task in `tasks/`.
2. Run the optimizer (using `harbor` or similar tool).
3. Meta-Agent analyzes failures and updates `agent.py:SYSTEM_PROMPT`.