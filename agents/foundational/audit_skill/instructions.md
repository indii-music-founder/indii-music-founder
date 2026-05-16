# Execution Protocol: Architecture Audit and Skill Routing

1. **Initialization:** Execute `scan_directory.py` with the `--root` argument pointing to the INDII agents directory.
2. **State Parsing:** Parse the JSON output to load the existing structure of the 20+ specialized agents into context.
3. **Redundancy Check:** Compare the requested new capability against the mapped tools to ensure no functional overlap.
4. **Skill Routing:** Determine the correct domain-specific agent folder for the new skill (e.g., `agents/country_pop_producer/skills/`).
5. **Composability Definition:** - Break down monolithic skill requests into single-purpose, composable file structures.
   - Enforce invocation controls. If the sub-skill is an agent-to-agent background process, write the configuration parameter: `user_invocable: false`.
6. **Output:** Print the precise file paths, structure requirements, and dependency links for the new skill deployment.
