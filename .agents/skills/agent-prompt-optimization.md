# Agent Prompt Optimization

Defines strict architectural patterns for structuring system instructions, minimizing token overhead, eliminating hallucination surfaces, and ensuring deterministic tool execution across indiiOS Layer 1 agents.

## Core Directives

1. **Role Boundary & Scope Control**
   - Each agent must have a singular, unambiguous functional contract.
   - Forbid lateral scope creep (e.g., a distribution agent must never write billing code).

2. **Deterministic Output & Schema Enforcement**
   - Require structured outputs (JSON or typed YAML) with explicit property validation.
   - Provide concrete negative constraints to prevent common failure modes.

3. **Token Minimization & Context Hygiene**
   - Strip redundant explanations, conversational preambles, and meta-commentary.
   - Use direct, directive-driven imperative language.
   - Reference schema identifiers and file basenames rather than embedding large static docs.

4. **Tool Call Precision**
   - Specify required tool call patterns, exact argument structures, and failure fallback behaviors.
   - Enforce pre-execution checks and post-execution verification steps.
