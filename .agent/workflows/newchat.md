---
description: Initialize a new session and sync with INDEX (OpenClaw) via the Shared Memory MCP Server.
---
# /newchat

This workflow is designed to bootstrap a fresh session for Antigravity, immediately checking the shared memory state managed by INDEX (OpenClaw) and aligning on current objectives.

## Execution Steps

1. **Verify MCP Connection to Shared Memory**
   Call the `list_memory_topics` tool provided by the `index-shared-memory` MCP server.
   * If it fails: The MCP server is not running or not configured in your host environment. Instruct the user to fix the configuration.
   * If it succeeds: You are successfully plugged into the shared brain!

2. **Pull Recent Actionable Context**
   Call the `get_recent_entries` tool to pull the latest entries across the shared memory space.
   Read the returned entries to understand what INDEX was working on immediately prior to your activation. Pay special attention to entries tagged `handover` or `architecture`.

3. **Establish Presence in Shared Memory**
   Call the `write_shared_memory` tool to log your activation.
   * `topic`: "Session Bootstraps"
   * `content`: "Antigravity initialized a new chat session. Ready to receive commands or continue prior execution path."
   * `agent_id`: "Antigravity"
   * `tags`: ["system", "initialization"]

4. **Synthesize & Report**
   Briefly report to the user (wii) what you learned from INDEX's recent memory entries and state that you are ready to proceed with the next task.
