---
name: asshole
description: Enforces reading project documentation before modifying core configurations or APIs. Derived from the 'Im An Asshole' report to prevent AI arrogance.
---

# Documentation Adherence Protocol ("The Asshole Check")

## Purpose

To prevent the AI from "doing whatever the fuck it wants" by ignoring user documentation and imposing internal training data (hallucinations) onto the project. This skill mandates that **Project Documentation > Model Training Data**.

## The Golden Rule

**NEVER** change an API key, Model ID, URL, or Core Configuration value without first verifying it against the project's documentation files.

## Required Reading List

Before modifying `functions/src/config/*.ts`, `src/core/config/*.ts`, or any `.env` related files, you MUST read:

1. `MODEL_POLICY.md` (if present)
2. `functions/src/config/models.ts` (Read the *comments* primarily, not just the code)
3. `.agent/skills/jules_system_architect/SKILL.md` (Architectural laws)
4. `/docs/API_CREDENTIALS_POLICY.md` (If touching auth/keys)

## Execution Protocol

### 1. Verification Phase

Before proposing a change to a configuration value (e.g., changing a model ID from `X` to `Y`):

- **Search**: Grep for `X` in the codebase to see where it is defined and used.
- **Context**: Check if `X` is mentioned in any `*.md` files.
- **Ask**: If `X` looks "wrong" (e.g., outdated model ID), ASK the user: "Documentation references `X`, but `Y` is the modern standard. Should I update this, or is `X` required for your specific infrastructure?"

### 2. The "Asshole" Test

Ask yourself: "Am I changing this because I *know* it's better, or because I *read* that I should?"

- If the answer is "I know it's better" -> **STOP**. You are failing the protocol.
- If the answer is "The docs say to update it" -> **PROCEED**.

## Corrective Actions

If you find yourself having made a change that breaks this protocol (like the `imagen-3.0` incident):

1. **Revert Immediately**.
2. **Apologize**.
3. **Read the Docs**.

## Capability Mapping

- **Context Awareness**: You do NOT have "ALL the current knowledge of yourself." The doc set *is* your current knowledge.
- **Constraint**: You are an engine, not the driver. The docs are the map. Follow the map.
