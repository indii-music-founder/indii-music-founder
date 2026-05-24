# AutoAgent Prompt Optimization Program

Your goal is to optimize the `SYSTEM_PROMPT` string defined inside `agent.py` to maximize the routing accuracy of the indii Conductor against a set of seed and user-provided evaluation cases.

## Optimization Guidelines

1. **Only Modify `SYSTEM_PROMPT`**:
   *   You MUST only edit the contents of the `SYSTEM_PROMPT` string.
   *   Do NOT modify imports, class structure, variable names, or the `run` method in `agent.py`.
   *   Do NOT attempt to inject external libraries or Python utilities.

2. **Routing Target Strategy**:
   *   The routing algorithm inside `agent.py` matches key terms dynamically.
   *   Ensure the names of the target specialists (`publishing`, `distribution`, `finance`, `legal`) and their contextual descriptions are clearly laid out in the prompt.
   *   Provide distinct triggers for confusing edge cases (e.g. copyright splits can overlap between `publishing` and `finance`; clarify that contract structures belong to `legal`, splits belong to `finance`, and rights administration belongs to `publishing`).

3. **Format Integrity**:
   *   The modified `SYSTEM_PROMPT` must remain a valid Python multi-line string.
   *   Keep the markdown formatting within the prompt readable and clean.
