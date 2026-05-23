---
description: The ultimate closed-loop automation workflow. Spins up the Test Orchestrator, the Fix Agent, and the CI Publisher simultaneously to run full system tests, auto-patch bugs, and deploy overnight.
---

# /factory — The Automated CI Factory

**Protocol for fully autonomous, closed-loop testing, fixing, and deployment.**

Use this workflow when you want to "turn the lights off" and let the swarm run the entire application through the gauntlet, fix any issues it finds, and push the clean code to `main`. 

## The Factory Flow

When `/factory` is invoked, the primary agent acts as the **Floor Manager** and MUST spin up the following three subagents simultaneously:

### 1. The Test Orchestrator
- **Role:** To break the app.
- **Task:** Iterates through all 24+ `live_test_*.md` protocols in `.agent/workflows/`. It spawns browser testing agents to execute each protocol against `localhost:4242`.
- **Output:** Logs every failure, crash, or visual bug directly into `OPEN_ISSUES.md`. 

### 2. The Fix Agent (`/issue`)
- **Role:** To patch the app.
- **Task:** Continuously monitors `OPEN_ISSUES.md`. The moment the Test Orchestrator logs a failure, the Fix Agent claims it, diagnoses the codebase, applies surgical fixes, verifies the fix locally, and marks the issue as `FIXED`.
- **Output:** Clean, working code that resolves the orchestrator's findings.

### 3. The QA & Publisher
- **Role:** To seal and ship the app.
- **Task:** Waits for the Test Orchestrator to complete its list and the Fix Agent to clear the queue. It then executes the `/ci-validate` workflow (`npm run typecheck`, `npm run lint`, `npm test`). 
- **Output:** If the tests pass and the branch is green, it consolidates the commits, writes a detailed summary artifact, and pushes the branch to `origin main`.

---

## Agent Instructions: How to Execute `/factory`

When the user types `/factory`, you (the orchestrating agent) must:
1. Acknowledge the command and begin the Factory startup sequence.
2. Use the `invoke_subagent` tool to spawn the **Test Orchestrator** and the **Fix Agent** in parallel.
3. Monitor their status. You do not need to actively poll; simply wait for the subagents to report back via messages.
4. Once both the testing loop and the fixing queue are completed, spawn the **QA & Publisher** subagent to finalize the push.
5. Provide a master summary of everything that was broken, fixed, and pushed.
