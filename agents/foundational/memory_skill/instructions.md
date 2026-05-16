# Execution Protocol: Memory Maintenance and Procedural Rewrite

1. **Intent Extraction:** Analyze user input to extract the exact procedural knowledge to be updated. Classify the operation as `add` or `remove`.
2. **Target Resolution:** Identify the specific agent domain (e.g., `agents/death_metal_producer/instructions.md`) impacted by the update.
3. **Execution:** Trigger `update_knowledge.py` with the following parameters:
   - `--file_path`: Absolute path to the target agent's `.md` instruction file.
   - `--action`: Explicitly set to `add` or `remove`.
   - `--content`: The strictly formatted procedural rule to inject or the exact substring to excise.
4. **Validation:** Check standard output from the Python script to confirm successful write execution.
5. **Confirmation:** Output a final confirmation message stating: `SYSTEM UPDATE COMPLETE: Changes permanently written to [Target Agent].`
